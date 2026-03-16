

# Plano final: Elegibilidade + Limpeza de planos App

## Estado atual confirmado

| Problema | Detalhe |
|---|---|
| ESPECIAL PLUS com `linha` errada | `linha = 'especial'` → deveria ser `'especial-plus'` |
| 9 variantes com 0 registros de elegibilidade | ADVANCED+, SELECT PREMIUM/EXCLUSIVE, SELECT ONE 5% PROMO, LANÇAMENTO PREMIUM/EXCLUSIVE |
| 3 planos "App" são vestígios | SELECT ONE APP, SELECT EXCLUSIVE APP, LANÇAMENTO EXCLUSIVE APP — 0 cotações, 0 contratos, `visivel_gestao = false`, já ignorados pelo motor de pricing |

---

## Operação 1 — Corrigir linha do ESPECIAL PLUS

```sql
UPDATE planos SET linha = 'especial-plus' WHERE id = '12cdd378-b42b-4389-a28f-1eba1fe7c837';
```

---

## Operação 2 — Copiar elegibilidade do plano base para variantes

Usando `INSERT ... SELECT ... WHERE NOT EXISTS` para cada grupo:

- **SELECT BASIC** (109 registros) → SELECT PREMIUM, SELECT EXCLUSIVE
- **SELECT ONE** (218 registros) → SELECT ONE 5% PROMO
- **LANÇAMENTO BASIC** (109 registros) → LANÇAMENTO PREMIUM, LANÇAMENTO EXCLUSIVE
- **ADVANCED** (6 registros) → ADVANCED+

Nota: os 3 planos "App" **não recebem cópia** — serão desativados a seguir.

---

## Operação 3 — Desativar os 3 planos "App" redundantes

```sql
UPDATE planos SET ativo = false 
WHERE id IN (
  'ba180738-4b11-4d7e-8ed0-7f73df3e5155',  -- SELECT ONE APLICATIVO
  'fd6be7d7-6ec7-4d2c-8b56-cca80d14c3f4',  -- SELECT EXCLUSIVE APLICATIVO
  '1addfd28-e67f-45da-8a87-efdb6311a32b'   -- LANÇAMENTO EXCLUSIVE APLICATIVO
);
```

Confirmado: 0 cotações e 0 contratos vinculados a eles.

---

## Operação 4 — Limpar plano_preco_map dos planos App

```sql
DELETE FROM plano_preco_map 
WHERE plano_id IN (
  'ba180738-4b11-4d7e-8ed0-7f73df3e5155',
  'fd6be7d7-6ec7-4d2c-8b56-cca80d14c3f4',
  '1addfd28-e67f-45da-8a87-efdb6311a32b'
);
```

Remove as 3 entradas de mapeamento de preço que não são mais usadas.

---

## Resultado esperado

| Plano | Linha | Elegibilidade | Status |
|---|---|---|---|
| ADVANCED | advanced | 6 | ativo |
| ADVANCED+ | advanced | 6 | ativo |
| ELÉTRICOS | eletricos | 25 | ativo |
| ESPECIAL | especial | 105 | ativo |
| ESPECIAL PLUS | **especial-plus** | 12 | ativo |
| LANÇAMENTO BASIC | lancamento | 109 | ativo |
| LANÇAMENTO PREMIUM | lancamento | 109 | ativo |
| LANÇAMENTO EXCLUSIVE | lancamento | 109 | ativo |
| SELECT BASIC | select | 109 | ativo |
| SELECT PREMIUM | select | 109 | ativo |
| SELECT EXCLUSIVE | select | 109 | ativo |
| SELECT ONE | select-one | 218 | ativo |
| SELECT ONE 5% PROMO | select-one | 218 | ativo |
| ~~SELECT ONE APP~~ | — | — | **desativado** |
| ~~SELECT EXCLUSIVE APP~~ | — | — | **desativado** |
| ~~LANÇAMENTO EXCLUSIVE APP~~ | — | — | **desativado** |

---

## Impacto

Todas as operações são de dados (UPDATE/INSERT/DELETE). Nenhuma mudança de código necessária — o motor de pricing já ignora esses planos App e resolve o adicional de aplicativo dinamicamente no plano base.

