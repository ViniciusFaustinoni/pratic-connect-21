
# Integração SGA na Troca de Titularidade

## Diagnóstico

Hoje a edge function `efetivar-troca-titularidade` faz toda a operação **somente no banco local** (atualiza `veiculos.associado_id`, cancela contrato antigo, cria novo, cobranças no Asaas). **Nenhuma chamada SGA acontece.** Resultado: no Hinova o veículo continua vinculado ao associado antigo e o novo associado pode nem existir lá. Isso quebra cobranças, sinistros e relatórios oficiais.

As demais operações de troca (`criar-solicitacao-troca-titularidade`, `aprovar-troca-cadastro`, `aprovar-troca-monitoramento`, `enviar-termo-cancelamento-troca`, `reprovar-troca-titularidade`) também não tocam o SGA.

O cliente compartilhado `_shared/hinova-client.ts` já implementa os blocos de baixo nível necessários (auth, retry, log em `hinova_logs`, sessão Bearer). Falta apenas orquestrar.

## Endpoints SGA relevantes para a Troca

Mapeados a partir da doc oficial (`https://api.hinova.com.br/api/sga/v2/doc/`):

### Autenticação
- `POST /usuario/autenticar` — já encapsulado em `getHinovaSession()`.

### Associado (novo titular)
- `POST associado/buscar/:cpfOuCodigo/:buscar_por` — verifica se o novo titular já existe no SGA (por CPF). Decide entre cadastrar ou reutilizar `codigo_associado`.
- `POST /associado/cadastrar` — cria o novo associado quando não existe. Usar dados validados na etapa "Cadastro" da troca (nome, CPF, RG, endereço, contatos, vencimento, plano).
- `POST /alterar/associado` — atualizar dados do novo titular se ele já existia mas com cadastro desatualizado (telefone, endereço, e-mail).
- `POST associado/alterar-situacao-para/:codigo_situacao/:codigo_associado` — opcional: garantir que o novo titular fique "Ativo" após a transferência, ou colocar o antigo em situação "Inativo/Cancelado" caso ele não tenha mais nenhum veículo (regra de negócio a confirmar).
- `POST associado/buscar-por-cpf-senha` / `associado/cartao/listar` — não aplicáveis ao fluxo.

### Veículo (transferência)
A doc pública lista apenas grupos Associado/Beneficiário/Atendimento, mas o cliente Hinova já usa rotas oficiais de Veículo:
- `GET /veiculo/buscar/:placa/placa` e `GET /veiculo/buscar/:chassi/chassi` — localiza `codigo_veiculo` e `codigo_associado` atuais no SGA. Confirma origem antes de cancelar.
- `POST /veiculo/alterar/situacao` — **passo 1 da troca**: marcar o veículo do associado antigo como "cancelado/inativo" (situação de saída). Mesma rota usada hoje em `cancelar-contrato`.
- `POST /veiculo/cadastrar` — **passo 2 da troca**: re-cadastrar o veículo vinculado ao novo `codigo_associado`, herdando `codigo_grupo_produto`, valor FIPE e dados técnicos (mesmo payload usado em `sga-hinova-sync`).
- `POST /veiculo/foto/cadastrar` — re-anexa as fotos da vistoria de troca ao novo registro (lotes ≤ 50).
- `GET /buscar/situacao-financeira-veiculo/:codigo` — antes de efetivar, confirma que o veículo no SGA está sem débito em aberto (mesma regra da inclusão).

### Histórico / Atendimento
- `POST /cadastrar/historico-atendimento-associado` — registra um histórico no SGA tanto no associado antigo ("Veículo XXX transferido para CPF YYY") quanto no novo ("Veículo XXX recebido de CPF ZZZ"), espelhando o que já gravamos em `associados_historico`.

## Arquitetura proposta

```text
efetivar-troca-titularidade  (orquestrador único, transação local + SGA)
 ├─ 1. Lock + validações locais (igual hoje)
 ├─ 2. SGA: garantir novo associado
 │     ├─ associado/buscar (CPF) → existe?
 │     │     ├─ sim  → /alterar/associado (sync de dados)
 │     │     └─ não  → /associado/cadastrar
 │     └─ persistir codigo_associado_novo em associados.codigo_sga
 ├─ 3. SGA: situação financeira do veículo
 │     └─ /buscar/situacao-financeira-veiculo  → bloqueia se débito
 ├─ 4. SGA: cancelar veículo no titular antigo
 │     └─ /veiculo/alterar/situacao  (situação "cancelado por troca")
 ├─ 5. SGA: cadastrar veículo no titular novo
 │     ├─ /veiculo/cadastrar  → grava novo codigo_veiculo
 │     └─ /veiculo/foto/cadastrar  (fotos da vistoria de troca)
 ├─ 6. Banco local (transação atual): troca contrato, veiculos.associado_id,
 │     historico, Asaas — usando os novos códigos SGA
 ├─ 7. SGA: histórico em ambos os associados
 │     └─ /cadastrar/historico-atendimento-associado  (×2)
 └─ 8. Em qualquer falha SGA não-recuperável → enfileira em
       sga_outbox (já existente) para retry automático e marca a
       solicitação como "efetivado_local_pendente_sga".
```

Nenhum endpoint novo é exposto ao frontend. A UI (`TelaAnaliseTrocaTitularidade`) só passa a exibir, no card de status, se ainda há sincronização SGA pendente — usando dados que já existem em `solicitacoes_troca_titularidade`.

## Mudanças por arquivo

**Edge functions**
- `supabase/functions/efetivar-troca-titularidade/index.ts` — adicionar etapas 2-5 e 7 acima, com tratamento de erro e fallback para `sga_outbox`. Mover a transação local para depois da confirmação dos passos SGA críticos (passos 4 e 5).
- `supabase/functions/_shared/hinova-client.ts` — adicionar dois helpers que ainda faltam:
  - `buscarAssociadoPorCpf(cpf)` (POST `associado/buscar/:cpf/cpf`).
  - `cadastrarHistoricoAssociado({ codigo_associado, descricao, ... })` (POST `/cadastrar/historico-atendimento-associado`).
  - `cadastrarAssociado(payload)` e `alterarAssociado(payload)` se ainda não existirem.
- `supabase/functions/_shared/hinova-payloads.ts` — tipos para o payload de cadastro/alteração de associado e de histórico.
- `supabase/functions/criar-solicitacao-troca-titularidade/index.ts` — opcional: pré-checar `associado/buscar` para já alertar se o CPF do novo titular já tem cadastro/SGA divergente.

**Banco**
- Migration: adicionar colunas em `solicitacoes_troca_titularidade`:
  - `sga_codigo_associado_novo bigint`
  - `sga_codigo_veiculo_novo bigint`
  - `sga_status text default 'pendente'` (`pendente | sincronizado | falha`)
  - `sga_erro text`, `sga_sincronizado_em timestamptz`.
- Reaproveitar tabela `sga_outbox` existente para enfileirar retries.

**Frontend (cosmético)**
- `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` — exibir badge "SGA: sincronizado / pendente / falha" usando os novos campos.
- `src/components/troca-titularidade/TimelineAprovacao.tsx` — adicionar etapa "Sincronização SGA" depois de "Efetivada".

## Casos de borda tratados

- **Novo titular já é associado SGA com débitos** → bloquear efetivação e exibir mensagem (mesma UX da inclusão de veículo).
- **Veículo não encontrado no SGA** → seguir só com cadastro novo (passo 5) e pular o passo 4.
- **Erro transitório SGA** → grava `sga_status='pendente'`, enfileira `sga_outbox`, retorna sucesso parcial; cron `cron-sga-retry` finaliza.
- **Reentrada (idempotência)** → antes de cadastrar veículo no novo titular, fazer `GET /veiculo/buscar/:chassi/chassi`; se já vinculado ao novo `codigo_associado`, pular.

## Pontos a confirmar com você

1. Quando o associado **antigo** fica sem nenhum outro veículo após a troca, devemos alterar a situação dele no SGA para "Inativo"? (hoje o sistema local não inativa.)
2. O histórico de atendimento no SGA deve ser criado em **ambos** os associados ou só no antigo?
3. Há um código de "situação de cancelamento por troca" específico no SGA do cliente, ou usamos o mesmo código de cancelamento padrão hoje empregado?

Após sua aprovação implemento a migration, os helpers no `hinova-client`, a reescrita do `efetivar-troca-titularidade` e o badge de status na UI.
