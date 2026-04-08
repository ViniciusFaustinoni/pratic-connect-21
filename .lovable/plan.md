

# Plano: Corrigir campos Ano Minimo e Ano Maximo na edicao de planos

## Problema

Os campos "Ano Minimo" e "Ano Maximo" existem no formulario de edicao do plano (`PlanFormModal`), porem:

1. **`ano_fabricacao_maximo` nao e salvo** — o campo existe no form mas NAO e incluido no objeto `planoData` em `usePlansAdmin.ts` (nem no create, nem no update)
2. **`min_vehicle_year` e um campo texto** ("2015+") convertido com regex — deveria ser numerico como o campo maximo
3. O motor de cotacao (`usePlanosCotacao.ts`) ja consome ambos corretamente (`ano_minimo` e `ano_fabricacao_maximo`)

## Alteracoes

### 1. `src/hooks/usePlansAdmin.ts` — Salvar `ano_fabricacao_maximo`

Adicionar `ano_fabricacao_maximo` ao objeto `planoData` em ambas as funcoes (`useCreatePlan` e `useUpdatePlan`):

```typescript
ano_fabricacao_maximo: planData.ano_fabricacao_maximo ?? null,
```

Isso requer que `PlanInput` tambem inclua `ano_fabricacao_maximo?: number | null`.

### 2. `src/components/admin/planos/PlanFormModal.tsx` — Tornar `min_vehicle_year` numerico

Mudar o campo "Ano Minimo" de texto livre ("2015+") para `type="number"`, igual ao campo "Ano Maximo". Ambos ficarao lado a lado como inputs numericos.

No `handleSubmit`, o payload ja envia `min_vehicle_year` e `ano_fabricacao_maximo`. Garantir que ambos sejam parseados corretamente.

### 3. `src/hooks/usePlansAdmin.ts` — Simplificar parsing do ano minimo

Trocar:
```typescript
ano_minimo: planData.min_vehicle_year ? parseInt(planData.min_vehicle_year.replace(/\D/g, '')) : null,
```
Por:
```typescript
ano_minimo: planData.min_vehicle_year ? parseInt(planData.min_vehicle_year) : null,
```

(O campo agora sera numerico, sem necessidade de regex.)

## Resultado

Ao editar/criar um plano, os campos "Ano Minimo" e "Ano Maximo" serao salvos corretamente no banco. O motor de cotacao ja os utiliza para filtrar veiculos fora da faixa de ano.

