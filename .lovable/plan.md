
## Objetivo

Hoje, ao escolher "Substituição de Placa" em **Outras Entradas**, o sistema busca a placa no SGA e já joga o consultor direto no Cotador. Falta a etapa intermediária de **solicitação** com **termo de cancelamento do veículo antigo** antes de gerar a nova cotação — exatamente como já existe na Troca de Titularidade.

A proposta é replicar o padrão da troca de titularidade para substituição, sem duplicar o que já existe.

## O que JÁ está pronto (reuso)

- Busca por placa no SGA → `useBuscaPlaca` + edge `sga-buscar-associado-completo` (já retorna veículo, associado, boletos, débito)
- Listagem em "Outros Processos" → `useOutrosProcessos` já tem `tipo: 'substituicao_placa'`
- Geração de termo de cancelamento Autentique → edge `enviar-termo-cancelamento-troca` + função `autentique-cancelamento-create` (reutilizável; só precisa parametrizar)
- Webhook Autentique já atualiza `termo_cancelamento_assinado_em` para troca — basta replicar gatilho para substituição
- Cotador `/vendas/cotacoes?associado_id=...&tipo_entrada=substituicao&veiculo_antigo_id=...` já existe e gera link público com fluxo padrão (plano, filiação, docs, vistoria, pagamento)
- Tabela `substituicoes_veiculo` existe mas é a tabela de **resultado** (mensalidade nova, contrato, taxa) — vamos manter o uso atual e criar uma tabela nova para a **solicitação**

## O que muda

### 1. Nova tabela `solicitacoes_substituicao_placa`

Espelhada em `solicitacoes_troca_titularidade`, com:

- `associado_id` (uuid local, importado do SGA se preciso)
- `sga_codigo_associado`, `sga_codigo_veiculo`
- `veiculo_antigo_snapshot` (jsonb — placa, modelo, marca, fipe, cota, situacao vindo do SGA)
- `associado_snapshot` (jsonb — nome, cpf, email, telefones, endereço)
- `cotacao_id` (preenchido depois que o consultor cria a nova cotação)
- `status`: `aguardando_termo` → `termo_enviado` → `termo_assinado` → `cotacao_criada` → `efetivada` / `cancelada`
- `termo_cancelamento_autentique_id`, `termo_cancelamento_url`, `termo_cancelamento_enviado_em`, `termo_cancelamento_assinado_em`, `termo_whatsapp_status`, `termo_reenvios_count`
- `criado_por`, `consultor_id`, `created_at`, `updated_at`
- `motivo_cancelamento`, `cancelada_em`

RLS: leitura para autenticados internos; escrita só por consultores/cadastro.

### 2. Edge functions

- **`criar-solicitacao-substituicao`** (nova) — recebe `placa`, importa associado do SGA se não existir local (reutiliza `importar-associado-sga`), grava snapshot, cria registro com status `aguardando_termo`. Retorna `solicitacao_id`.
- **`enviar-termo-cancelamento-substituicao`** (nova; clona `enviar-termo-cancelamento-troca`) — gera doc Autentique para o associado titular cancelando o veículo antigo. Atualiza `status='termo_enviado'`. Webhook Autentique existente passa a olhar essa tabela também e marcar `termo_assinado` quando assinado.
- **`autentique-webhook`** (ajuste) — adiciona branch para a nova tabela.
- Marca `veiculos.em_substituicao=true` no veículo antigo ao enviar termo (espelha padrão `em_troca_titularidade`) — protege contra outras operações concorrentes.

### 3. UI — `OutrasEntradasMenu.tsx` (substituição)

Substituir o `handleProsseguir` atual (que navega direto para Cotador) por um **mini-fluxo em 2 telas dentro do próprio modal**:

```text
[busca placa SGA] → [card resumo: veículo + associado + situação financeira]
                                                                         │
                                                          [Criar Solicitação] (botão primário)
                                                                         │
                                  redireciona para /vendas/outros-processos?destacar={id}
```

Mostra alerta amarelo se houver débitos (não bloqueia — confirmado pelo usuário).

### 4. UI — `ModalDetalhesOutroProcesso` para substituição

Hoje há `ModalDetalhesTroca`. Vamos criar **`ModalDetalhesSubstituicao`** (estrutura idêntica, layout reutilizando blocos):

Aba **Resumo**:
- Card "Associado" (nome, CPF, contatos, situação SGA)
- Card "Veículo a substituir" (placa, modelo, FIPE, cota, mensalidade)
- Card "Situação financeira" (boletos abertos via SGA — reaproveita `AnalisePreviaNovoTitularCard` adaptado)

Aba **Termo de Cancelamento**:
- Estado `aguardando_termo` → botão **"Enviar Termo de Cancelamento do veículo {PLACA}"**
- Estado `termo_enviado` → status + botão "Reenviar por WhatsApp", contador de reenvios, link Autentique
- Estado `termo_assinado` → ✓ assinado em {data} + botão **"Criar Nova Cotação"** (verde, primário)

Aba **Nova Cotação**:
- Antes de criada: placeholder "Aguardando assinatura do termo"
- Depois: card com link público da cotação + status (escolha de plano, termo filiação, docs, vistoria, pagamento) — reutiliza `CotacaoStatusCard`

### 5. Botão "Criar Nova Cotação"

Não cria entidade nova — apenas navega para o Cotador já existente, passando `solicitacao_substituicao_id` na URL além dos params atuais. O Cotador grava esse id em `cotacoes.dados_extras.solicitacao_substituicao_id`. Trigger atualiza a solicitação com `cotacao_id` e move status para `cotacao_criada`. Daí em diante o fluxo público é 100% o do Cotador (sem alteração).

### 6. Hook `useOutrosProcessos`

Atualizar a query para também ler de `solicitacoes_substituicao_placa` (LEFT JOIN), preenchendo `solicitacao_substituicao_id`, `termo_status`, `termo_url`, etc. Os campos da interface já existem genéricos — só mapear.

## Fora do escopo

- Não alteramos `substituicoes_veiculo` (continua sendo o registro de fechamento pós-pagamento)
- Não mexemos no fluxo público do associado (escolha plano/filiação/docs/vistoria/pagamento)
- Não bloqueamos por débito (decisão do usuário)
- Sem aprovação Cadastro/Monitoramento entre termo assinado e nova cotação (decisão do usuário)

## Arquivos a criar / editar

**Novos:**
- migration `solicitacoes_substituicao_placa` (tabela + RLS + trigger updated_at)
- `supabase/functions/criar-solicitacao-substituicao/index.ts`
- `supabase/functions/enviar-termo-cancelamento-substituicao/index.ts`
- `src/hooks/useSolicitacoesSubstituicao.ts`
- `src/components/substituicao/ModalDetalhesSubstituicao.tsx`
- `src/components/substituicao/CardResumoSubstituicao.tsx` (etapa 2 do menu)

**Editar:**
- `src/components/vendas/OutrasEntradasMenu.tsx` — trocar `handleProsseguir` da substituição pelo novo fluxo de 2 etapas
- `src/hooks/useOutrosProcessos.ts` — incluir join com a nova tabela
- `src/pages/vendas/Cotacoes.tsx` (ou Cotador) — ler `solicitacao_substituicao_id` da URL e gravar em `dados_extras`
- `supabase/functions/autentique-webhook/index.ts` — branch para nova tabela
- Memória do projeto — registrar o novo fluxo
