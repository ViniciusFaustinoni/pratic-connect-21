

# Plano "SELECT ONE 5% PROMO" — Desconto Percentual Dinâmico

## Resumo

Adicionar coluna `desconto_percentual` à tabela `planos`, criar o plano promocional e integrar o desconto nos cálculos e no CRUD admin.

## 1. Migration SQL — Schema + Dados

**Nova coluna** `desconto_percentual NUMERIC DEFAULT 0` na tabela `planos`.

**Inserir plano** `SELECT ONE 5% PROMO` copiando dados do `select-one` existente, com `desconto_percentual = 5` e `badge_text = '5% OFF'`.

**Inserir mapeamento** em `plano_preco_map` apontando para `linha_slug = 'select-one'` (mesma tabela de preços base).

## 2. Tipos — `src/types/cotacao.ts`

Adicionar `desconto_percentual: number` ao interface `PlanoParaCotacao` (linha 63).

## 3. Mapeamento — `src/hooks/useCotacao.ts`

No `mapPlanoToInterface` (linha 63): adicionar `desconto_percentual: Number(data.desconto_percentual || 0)`.

Na função `encontrarFaixaMensalidade`: receber `descontoPercentual` como parâmetro e aplicar **após** adicional_mensal:
```
valorMensalFinal *= (1 - descontoPercentual / 100);
```

Na chamada dentro de `calcular` (linha 256): passar `plano.desconto_percentual || 0`.

## 4. Cálculo público — `src/hooks/useCalcularCotacao.ts`

Após a linha 136 (`valorMensal += Number(plano.adicional_mensal || 0)`), aplicar:
```
const desconto = Number(plano.desconto_percentual || 0);
if (desconto > 0) {
  valorMensal *= (1 - desconto / 100);
}
```

Aplicar o mesmo ao `valorDesagio` se existir.

## 5. CRUD Admin — `src/components/admin/planos/PlanFormModal.tsx`

Adicionar campo `desconto_percentual` ao form state (default `''`).

Na aba "Cotas", adicionar input:
```
<Label>Desconto Promocional (%)</Label>
<Input type="number" step="0.1" placeholder="0" />
<p class="text-xs text-muted-foreground">
  Percentual de desconto sobre o valor mensal (ex: 5 = 5% OFF)
</p>
```

No `handleSubmit` payload: incluir `desconto_percentual`.

No reset/edit: popular a partir de `plan.desconto_percentual`.

## 6. CRUD Hook — `src/hooks/usePlansAdmin.ts`

No `PlanInput`: adicionar `desconto_percentual?: number | null`.

No `useCreatePlan` e `useUpdatePlan`: mapear `desconto_percentual` para o campo do banco.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | ADD COLUMN + INSERT plano + INSERT plano_preco_map |
| `src/types/cotacao.ts` | Campo `desconto_percentual` |
| `src/hooks/useCotacao.ts` | Mapear + aplicar desconto |
| `src/hooks/useCalcularCotacao.ts` | Aplicar desconto público |
| `src/components/admin/planos/PlanFormModal.tsx` | Campo editável |
| `src/hooks/usePlansAdmin.ts` | Incluir no create/update |

