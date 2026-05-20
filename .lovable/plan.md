Revisão do plano incorporando seus 7 passos e a reformulação da decisão funcional. A ordem mudou: dimensionar antes, separar bugs do caso Eder, investigar a trigger antiga antes de neutralizá-la, e só depois implementar com critérios de aceitação verificáveis.

## Passo 0 — Dimensionar antes de mexer

Antes de qualquer código, rodar queries de auditoria que respondam:

- **A**: quantas autovistorias hoje têm `servico` "genérico paralelo" — ou seja, mais de um `servicos` apontando para o mesmo `vistoria_origem_id`, ou um `servico` com `modalidade != 'autovistoria'` ligado a uma `vistoria` com `modalidade='autovistoria'`.
- **B**: quantas `instalacoes` reaproveitaram serviço de autovistoria — `servicos.instalacao_origem_id IS NOT NULL` E `servicos.modalidade='autovistoria'` (ou `origem='autovistoria_publica'`).
- **C**: quantos contratos têm `instalacoes.dispensa_rastreador=true` em veículos que pela FIPE não deveriam dispensar (moto FIPE ≥ 9k, carro FIPE ≥ 30k, Diesel).
- **D**: lista nominal de cada caso encontrado em A/B/C — placa, associado, contrato, cotação, ids, datas.

Saída: um relatório salvo em `/mnt/documents/diagnostico-autovistoria-vs-instalacao.csv`. Sem esses números não há como priorizar nem comunicar impacto.

## Passo 1 — Ticket independente: classificação de tipo do veículo

Tratado como **ticket separado**, sem depender do resto do plano.

- Substituir, em `aprovar-proposta/index.ts`, a heurística local `detectarTipoVeiculo()` pela fonte canônica já usada em `criar-instalacao-pos-pagamento`: `supabase.rpc('fn_veiculo_precisa_rastreador', { _veiculo_id })`.
- Garantir que `instalacoes.dispensa_rastreador` derive sempre dessa fonte única.
- Validar com o caso Eder Lopes (Honda ADV 150, FIPE R$ 20.653 — moto).
- Liberar antes da Frente 2.

## Passo 2 — Investigar a trigger antiga antes de neutralizar

Antes de mexer em `sync_vistoria_to_servicos()`:

- Listar todos os caminhos de código que dependem do serviço gerado por essa trigger hoje (vistoria de saída, sinistro, periódica, manutenção, cancelamento — qualquer `vistoria` que não é autovistoria).
- Confirmar com você caso a caso se neutralizar essa trigger **só para `modalidade='autovistoria'`** quebra algum fluxo. Os usos para os outros tipos continuam intactos.
- Escrever testes (Deno) que cubram os fluxos que continuam dependendo dessa trigger antes da mudança.

Decisão funcional que preciso confirmar com você:
- A neutralização será **escopada** a `modalidade='autovistoria'`. Os demais tipos de vistoria seguem produzindo serviço pela trigger genérica como hoje. Você confirma?

## Passo 3 — Separação de identidade (núcleo da correção)

Três frentes só depois dos passos 0–2:

**3.1 Trigger não cria genérico para autovistoria**
- Em `sync_vistoria_to_servicos()`: `IF NEW.modalidade = 'autovistoria' THEN RETURN NEW;` no topo da função. A criação do serviço canônico continua sendo de `finalizar-autovistoria-cotacao` e de `fn_materializar_autovistoria_cotacao`.

**3.2 Instalação nunca reaproveita autovistoria**
- Em `sync_instalacao_to_servicos()`: na busca por "serviço vivo reaproveitável", excluir explicitamente `modalidade='autovistoria'` e `origem='autovistoria_publica'`. Se o único candidato for autovistoria, cria serviço presencial novo.

**3.3 Guard de integridade no banco — transições proibidas exaustivas**
Trigger nova `trg_guard_autovistoria_servico_disjunto` em `servicos`. Bloqueia (com `RAISE EXCEPTION`) todas as transições proibidas, listadas exaustivamente:

Para serviço com `modalidade='autovistoria'`:
- não pode receber `instalacao_origem_id` (de NULL para não-NULL).
- não pode transitar para nenhum status operacional físico: `agendada`, `em_rota`, `em_andamento`, `concluida`, `reagendada`, `nao_compareceu`, `aprovada_ressalvas`.
- transições válidas explícitas: `em_analise` → `aprovada` ou `em_analise` → `reprovada` ou `em_analise` → `cancelada`. Nada mais.

Para serviço com `instalacao_origem_id IS NOT NULL`:
- não pode ter `modalidade='autovistoria'` nem `origem='autovistoria_publica'`.

Guard adicional em `vistorias`: vistoria com `modalidade='autovistoria'` nunca pode receber `instalacao_id`.

## Passo 4 — Saneamento com migration explícita e dry-run

Migration de saneamento estruturada em 4 partes:

**a) Identificação nominal**
Query que produz a lista exata dos registros contaminados (mesma usada no Passo 0). Lista salva como `INSERT INTO public.saneamento_autovistoria_log` antes de qualquer modificação.

**b) Flag de auditoria**
Adicionar coluna `is_artefato_saneado boolean DEFAULT false` em `servicos` e `instalacoes`. Marcar todos os registros que serão tocados antes de modificar — preserva histórico e permite reverter.

**c) Decisão caso a caso**
- Serviço `modalidade='autovistoria'` com `instalacao_origem_id`: desvincular (`instalacao_origem_id = NULL`), manter status terminal `aprovada`, anotar em `observacoes`.
- Instalação com `dispensa_rastreador=true` indevido + sem rastreador + sem instalador: cancelar a instalação (`status='cancelada'`) e reabrir cotação para `aguardando_instalacao`. Mesmo padrão da migration `20260520134619`.
- Serviço presencial duplicando autovistoria para o mesmo `vistoria_origem_id`: cancelar o presencial órfão, manter o canônico de autovistoria.

**d) Relatório**
Ao final, gerar `SELECT` que mostra: total tocado por categoria, ids, ação tomada. Salvar em `logs_auditoria`.

**Dry-run obrigatório**
Antes de aplicar em produção: rodar a migration em homologação, conferir o relatório, só então aplicar.

## Passo 5 — Critérios de aceitação verificáveis

Três checks executáveis depois da correção:

**Check 1 — Query de invariante #1**
```sql
SELECT COUNT(*) FROM servicos s
JOIN vistorias v ON v.id = s.vistoria_origem_id
WHERE v.modalidade = 'autovistoria'
  AND s.instalacao_origem_id IS NOT NULL;
-- Deve retornar 0
```

**Check 2 — Query de invariante #2**
```sql
SELECT vistoria_origem_id, COUNT(*) 
FROM servicos
WHERE vistoria_origem_id IS NOT NULL
GROUP BY vistoria_origem_id
HAVING COUNT(*) > 1;
-- Deve retornar 0 linhas
```

**Check 3 — Teste manual em homologação**
Completar uma autovistoria de ponta a ponta e validar que:
- gera exatamente **um** serviço, com `modalidade='autovistoria'` e `origem='autovistoria_publica'`
- a instalação subsequente gera **outro** serviço, com `modalidade='presencial'`, sem reaproveitamento
- o caso Eder Lopes (após saneamento) aparece em Serviços de Campo do Monitoramento quando o link público completa o agendamento da instalação

## Passo 6 — Documentação da separação semântica

Nova memória `mem://logic/operations/autovistoria-vs-servico-presencial-disjuntos`:

> Autovistoria é artefato histórico/técnico, com ciclo de vida próprio (`em_analise` → `aprovada` ou `em_analise` → `reprovada` ou `em_analise` → `cancelada`), nunca migrando para status operacionais físicos. Instalação/serviço presencial é artefato operacional, com ciclo próprio e independente, que **consulta** a autovistoria mas nunca a **herda** como serviço.
> 
> Transições válidas explícitas listadas. Triggers que reforçam: `trg_guard_autovistoria_servico_disjunto`, `sync_vistoria_to_servicos` (escopada), `sync_instalacao_to_servicos` (exclui autovistoria).

Adicionar uma linha em `## Core` do `mem://index.md` apontando para essa memória.

## Passo 7 — Postmortem estrutural

Levantamento sincero, fora do código, sobre:

- Como uma trigger genérica de 2026-01 sobreviveu intacta enquanto várias regras novas foram construídas em volta dela?
- Houve, em algum momento, uma auditoria sistemática de triggers existentes antes de adicionar guards novos? Se não, por quê?
- Quais outras triggers antigas em outras tabelas seguem a mesma estrutura "criar automaticamente registro genérico ao inserir em X" e podem estar gerando bugs do mesmo formato em outros módulos (instalacoes, agendamentos_base, contratos, vistorias)?

Saída: um documento curto em `/mnt/documents/postmortem-trigger-antiga.md` listando outras triggers candidatas e recomendação se cada uma precisa do mesmo tratamento. Sem implementação — só mapa.

## Sequência de execução

```text
Passo 0 (queries de dimensionamento)
   ↓
Passo 1 (ticket isolado: classificação tipo de veículo) ──→ deploy independente
   ↓
Passo 2 (investigar trigger antiga + testes dos outros usos)
   ↓
Passo 3 (3.1 + 3.2 + 3.3 guards exaustivos)
   ↓
Passo 4 (saneamento com flag + dry-run em homologação)
   ↓
Passo 5 (checks de invariante + teste manual)
   ↓
Passo 6 (memória nova)
   ↓
Passo 7 (postmortem + mapa de triggers candidatas)
```

## Arquivos previstos

- Passo 0/D: relatório em `/mnt/documents/diagnostico-autovistoria-vs-instalacao.csv` (read-only).
- Passo 1: `supabase/functions/aprovar-proposta/index.ts`.
- Passo 2: `supabase/functions/finalizar-autovistoria-cotacao/_test.ts` (e correlatos).
- Passo 3: nova migration com edits em `sync_vistoria_to_servicos`, `sync_instalacao_to_servicos`, criação de `fn_guard_autovistoria_servico_disjunto` + trigger.
- Passo 4: nova migration de saneamento + coluna `is_artefato_saneado` + `saneamento_autovistoria_log`.
- Passo 6: `mem://logic/operations/autovistoria-vs-servico-presencial-disjuntos.md` + atualização do `mem://index.md`.
- Passo 7: `/mnt/documents/postmortem-trigger-antiga.md`.

## Decisões que preciso de você antes de executar

1. **Confirma** que a neutralização da `sync_vistoria_to_servicos()` será escopada só a `modalidade='autovistoria'`, mantendo intactos os demais tipos de vistoria (saída, sinistro, periódica, manutenção, cancelamento)?
2. **Confirma** a lista exaustiva de transições válidas da autovistoria: `em_analise` → `aprovada` | `reprovada` | `cancelada`. Algo mais é válido (ex.: voltar para `em_analise` em recurso)?
3. **Confirma** que a regra para saneamento de instalação com `dispensa_rastreador=true` indevido é cancelar (`status='cancelada'`) e reabrir cotação para `aguardando_instalacao`? Ou prefere outra ação (ex.: corrigir `dispensa_rastreador=false` e manter `agendada`)?
4. Quer que o Passo 0 (dimensionamento) seja executado **agora**, ainda neste loop, antes do plano ser aprovado? Eu posso rodar só as queries — não toca em nada.