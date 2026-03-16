

## Resultado da Verificação

Todos os 13 planos ativos têm registros na tabela `plano_elegibilidade_modelos`:

| Plano | Total de registros |
|---|---|
| ADVANCED+ | 6 |
| ADVANCED | 6 |
| ESPECIAL PLUS | 12 |
| ELÉTRICOS | 25 |
| ESPECIAL | 105 |
| SELECT BASIC | 109 |
| LANÇAMENTO PREMIUM | 109 |
| SELECT EXCLUSIVE | 109 |
| LANÇAMENTO BASIC | 109 |
| SELECT PREMIUM | 109 |
| LANÇAMENTO EXCLUSIVE | 109 |
| SELECT ONE 5% PROMO | 218 |
| SELECT ONE | 218 |

**Nenhum plano com zero registros.** A mudança para whitelist é segura.

## Correções a aplicar

**Arquivo único:** `src/hooks/usePlanosCotacao.ts`, função `verificarElegibilidadeModelo` (linhas 199-225)

### Correção 1 — Inverter lógica para whitelist (linha 221)
- `if (!regra) return 'aprovado'` → `if (!regra) return 'negado'`

### Correção 2 — Normalizar modelo antes de comparar (linhas 207-218)
- Adicionar função `normalizarModelo` que remove motorização (ex: `"VOYAGE 1.6"` → `"VOYAGE"`, `"ONIX PLUS 1.0"` → `"ONIX PLUS"`)
- Usar regex: `.replace(/\s+\d[\d.,V].*$/i, '').trim()`
- Aplicar tanto no modelo do veículo quanto no modelo da regra do banco

Nenhum outro arquivo será alterado.

