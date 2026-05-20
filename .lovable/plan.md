# Higienização + Barreira definitiva contra serviços duplicados

## Objetivo
Limpar os 16 grupos / 18 linhas duplicadas em `servicos` que ainda aparecem em Serviços de Campo **e** fechar as lacunas que permitiram a duplicação, para que nada mais entre duplicado.

---

## Parte A — Higienização (18 linhas existentes)

1. **Schema** — migration adiciona em `public.servicos`:
   - Coluna `dedup_substituido_por uuid NULL` (FK lógica para `servicos.id`)
   - Índice parcial `idx_servicos_dedup_substituido_por` para queries rápidas
   - Trigger `trg_no_resurrect_dedup` impede `UPDATE` que tire `dedup_substituido_por` de volta para `NULL`

2. **Data update (mesma migration, idempotente)** — para cada grupo duplicado, identifica o "keeper" canônico por prioridade:
   - Status: `em_analise`/`agendada`/`em_andamento` > `concluida`/`aprovada`/`aprovada_ressalvas` > `cancelada`/`reprovada`/`nao_compareceu`
   - Empate: maior `created_at`
   - Grupos cobertos: `instalacao_origem_id`, `vistoria_origem_id`, e par canônico `(associado_id, veiculo_id, tipo∈{instalacao,vistoria_entrada})`
   
   Nos não-keepers:
   - `dedup_substituido_por = keeper_id`
   - `observacoes = '[DEDUP→' || keeper_id || '] ' || coalesce(observacoes,'')`
   - Se status não-terminal, força `status='cancelada'` + `motivo_cancelamento='dedup_automatica'`
   
   **Sem DELETE físico** — preserva FKs e auditoria.

3. **Filtro de UI** — `src/hooks/useServicos.ts` passa a aplicar `.is('dedup_substituido_por', null)` em todas as queries de listagem (Serviços de Campo, Monitoramento, AprovacaoInstalacao). Painel cai ~18 linhas.

---

## Parte B — Barreira definitiva (nada mais entra duplicado)

1. **Índices únicos canônicos** (substituem `uq_servicos_instalacao_origem_vivo` e `uq_servicos_vistoria_origem_vivo`):
   ```text
   uq_servicos_instalacao_origem_canonico
     ON (instalacao_origem_id)
     WHERE instalacao_origem_id IS NOT NULL
       AND dedup_substituido_por IS NULL
       AND status NOT IN ('cancelada','reprovada','nao_compareceu')
   
   uq_servicos_vistoria_origem_canonico
     ON (vistoria_origem_id)
     WHERE vistoria_origem_id IS NOT NULL
       AND dedup_substituido_por IS NULL
       AND status NOT IN ('cancelada','reprovada','nao_compareceu')
   ```
   Diferença vs antigos: incluem `aprovada`/`concluida`/`aprovada_ressalvas` (que hoje passam pelo filtro e empilham).

2. **Trigger `dedupe_servicos_on_insert` estendida** — antes de inserir, se já existe serviço vivo com mesma `instalacao_origem_id` OU mesma `vistoria_origem_id` OU mesmo par `(associado_id, veiculo_id, tipo_canonico)` onde `tipo_canonico` colapsa `vistoria_entrada↔instalacao`, retorna o existente (no-op) em vez de inserir.

3. **Idempotência nas origens**:
   - `supabase/functions/finalizar-autovistoria-cotacao/index.ts`: antes do `INSERT` em `servicos`, faz `SELECT` por `vistoria_origem_id` e reaproveita se existir.
   - `fn_materializar_autovistoria_cotacao`: insere com `ON CONFLICT DO NOTHING` usando os novos índices canônicos.

---

## Parte C — Validação pós-deploy

1. Re-rodar a query de auditoria → esperado `0 grupos`, `0 linhas excedentes`.
2. Tentar `INSERT` manual com `vistoria_origem_id` já existente → deve falhar pelo índice único.
3. Conferir Serviços de Campo / Monitoramento → ~18 linhas a menos, fila do TIB8F32 mostra apenas o card canônico.
4. Spot-check em 3 cotações recentes de autovistoria sub-FIPE para confirmar que continuam materializando 1 serviço (não 0, não 2).

---

## Arquivos

**Migration (Parte A + B, schema + data + triggers + índices)**
- `supabase/migrations/<timestamp>_dedup_servicos_canonico.sql`

**Código**
- `src/hooks/useServicos.ts` — filtro `dedup_substituido_por IS NULL`
- `supabase/functions/finalizar-autovistoria-cotacao/index.ts` — guard idempotente

**Memória**
- `mem://logic/operations/servicos-um-canonico-por-origem.md` — atualizar com nova regra (índices canônicos incluem aprovada/concluida + coluna `dedup_substituido_por`)

---

## Fora de escopo
- Nenhum DELETE físico
- Nenhuma sincronização retroativa com SGA/Hinova (linhas dedup não foram para o Hinova de qualquer forma)
- Fluxos legítimos de reagendamento permanecem funcionando (status terminal libera o slot)
