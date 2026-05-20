# Higienização + barreira definitiva contra duplicatas em Serviços de Campo

## Diagnóstico atual

Auditoria da tabela `servicos` com a mesma chave canônica que a UI usa (`instalacao_origem_id` → `vistoria_origem_id` → `associado+veículo+tipo_canônico`, com `vistoria_entrada ≡ instalacao`):

| Chave de origem | Grupos duplicados | Linhas excedentes | Grupos c/ 2+ vivos |
|---|---:|---:|---:|
| `vistoria_origem_id` | 12 | 14 | 0 |
| `instalacao_origem_id` | 3 | 3 | 0 |
| `associado+veículo+tipo` (fallback) | 1 | 1 | 0 |
| **Total** | **16** | **18** | **0** |

**Nenhum grupo tem 2+ serviços vivos** — todos os excedentes são `cancelada`/`reprovada`/`aprovada`/`concluida` empilhadas, resíduo de execuções pré-correção do `finalizar-autovistoria-cotacao` e da trigger `fn_materializar_autovistoria_cotacao`.

## Barreiras já existentes (auditadas)

```text
UNIQUE INDEX uq_servicos_instalacao_origem_vivo
  ON servicos(instalacao_origem_id)
  WHERE instalacao_origem_id IS NOT NULL
    AND status NOT IN ('cancelada','reprovada');

UNIQUE INDEX uq_servicos_vistoria_origem_vivo
  ON servicos(vistoria_origem_id)
  WHERE vistoria_origem_id IS NOT NULL
    AND status NOT IN ('cancelada','reprovada');

TRIGGER trg_dedupe_servicos_on_insert  -- cancela vivos antigos por (assoc,veículo,tipo)
TRIGGER trg_cancelar_vistoria_entrada_orfa_servico  -- instalacao cancela vistoria_entrada órfã
```

**Lacunas que ainda permitem entulho histórico**:

1. Os índices permitem **N rows `aprovada`/`concluida`** por origem (só excluem `cancelada`/`reprovada`). Quando a materialização da autovistoria roda duas vezes e a primeira já virou `aprovada`, a segunda passa.
2. `trg_dedupe_servicos_on_insert` filtra por `tipo = NEW.tipo` — não enxerga o par `vistoria_entrada ↔ instalacao` (canônicos).
3. A trigger `fn_materializar_autovistoria_cotacao` e o edge `finalizar-autovistoria-cotacao` não são idempotentes por `(cotacao_id, vistoria_origem_id)`.

## Plano

### Parte A — Higienização do passivo (18 linhas)

**A.1** Schema:
```text
ALTER TABLE servicos
  ADD COLUMN IF NOT EXISTS dedup_substituido_por uuid REFERENCES servicos(id);
CREATE INDEX IF NOT EXISTS idx_servicos_dedup_substituido_por
  ON servicos(dedup_substituido_por) WHERE dedup_substituido_por IS NOT NULL;
```

**A.2** Marcação dos não-canônicos (uma transação, sem DELETE):
- Eleger keeper por prioridade `em_andamento/em_rota/em_analise/agendada/pendente > concluida/aprovada > aprovada_ressalvas > nao_compareceu > reprovada > cancelada`, desempate `created_at DESC`.
- Não-keepers recebem `dedup_substituido_por = keeper_id` + prefixo `[DEDUP→<keeper_id>]` em `observacoes`.
- **Não delete** (preserva FKs em `vistorias`, `agendamentos_base`, `ressalvas`).

**A.3** UI defense-in-depth: `useServicos` (`src/hooks/useServicos.ts`) filtra `.is('dedup_substituido_por', null)`.

### Parte B — Barreira definitiva (nada mais entra duplicado)

**B.1** Endurecer os índices únicos para incluir terminais "positivos" (`aprovada`/`concluida`/`aprovada_ressalvas`) — só permite reinserir após `cancelada`/`reprovada`/`nao_compareceu`:
```text
DROP INDEX uq_servicos_instalacao_origem_vivo;
DROP INDEX uq_servicos_vistoria_origem_vivo;

CREATE UNIQUE INDEX uq_servicos_instalacao_origem_canonico
  ON servicos(instalacao_origem_id)
  WHERE instalacao_origem_id IS NOT NULL
    AND dedup_substituido_por IS NULL
    AND status NOT IN ('cancelada','reprovada','nao_compareceu');

CREATE UNIQUE INDEX uq_servicos_vistoria_origem_canonico
  ON servicos(vistoria_origem_id)
  WHERE vistoria_origem_id IS NOT NULL
    AND dedup_substituido_por IS NULL
    AND status NOT IN ('cancelada','reprovada','nao_compareceu');
```
Permite reagendamento legítimo (cancela → cria novo) e bloqueia materialização redundante mesmo quando a anterior já virou `aprovada`/`concluida`.

**B.2** Estender `dedupe_servicos_on_insert` para colapsar par `vistoria_entrada ↔ instalacao`:
```text
... WHERE tipo IN (
  CASE NEW.tipo
    WHEN 'instalacao' THEN ARRAY['instalacao','vistoria_entrada']
    WHEN 'vistoria_entrada' THEN ARRAY['instalacao','vistoria_entrada']
    ELSE ARRAY[NEW.tipo::text]
  END
)::tipo_servico[] ...
```

**B.3** Idempotência nas duas fontes de materialização da autovistoria:
- Edge `supabase/functions/finalizar-autovistoria-cotacao/index.ts`: antes de `INSERT` em `servicos`, fazer `SELECT id FROM servicos WHERE vistoria_origem_id = :v LIMIT 1` — se existe, reutiliza e retorna 200 idempotente.
- Função SQL `fn_materializar_autovistoria_cotacao`: `INSERT ... ON CONFLICT DO NOTHING` usando o novo índice único como árbitro implícito + `SELECT` de fallback.

### Parte C — Validação

1. Re-rodar query de auditoria → esperado `0 grupos`.
2. Tentar inserir manualmente (via SQL) um `servicos` com `vistoria_origem_id` já existente — deve falhar com violação de unique.
3. Abrir `/monitoramento/vistorias-instalacoes-mon` — contador deve cair ~18 linhas (~154 em vez de 172).
4. Conferir caso TIB8F32 — apenas o card de Instalação canônico aparece.

## Arquivos

- **Migration (schema):** coluna `dedup_substituido_por` + 2 novos índices únicos + 2 índices antigos dropados + função `dedupe_servicos_on_insert` estendida.
- **Migration (data, via insert tool):** UPDATE marcando os 18 não-keepers.
- **Edge function:** `supabase/functions/finalizar-autovistoria-cotacao/index.ts` — guard de idempotência por `vistoria_origem_id`.
- **SQL function:** `fn_materializar_autovistoria_cotacao` — `ON CONFLICT DO NOTHING`.
- **Frontend:** `src/hooks/useServicos.ts` — `.is('dedup_substituido_por', null)`.
- **Memória:** atualizar `mem://logic/operations/servicos-um-canonico-por-origem.md` com a nova regra (índices canônicos incluem terminais positivos; coluna `dedup_substituido_por` marca histórico).

## Out of scope

- Sem DELETE físico (preserva FKs e trilha de auditoria).
- Sem mudar fluxos legítimos de reagendamento (`realocar_servico` continua válido — cancela → cria novo, segue passando).
- Sem retroalimentar SGA/Hinova com as linhas marcadas — eram fantasmas que nunca saíram daqui.
