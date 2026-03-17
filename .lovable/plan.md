

## Diagnóstico

O cotador usa `plano.coberturas` (array de texto hardcoded na tabela `planos`) em vez da tabela relacional `planos_beneficios`. Isso acontece em dois pontos:

1. **Query do hook** (`usePlanosCotacao.ts` L115-124): busca `planos` com `SELECT *` mas **não faz JOIN** com `planos_beneficios`
2. **Montagem do resultado** (`usePlanosCotacao.ts` L527): `const coberturas = Array.isArray(plano.coberturas) ? plano.coberturas : []`
3. **Componente de exibição** (`PlanoCardCotacao.tsx` L109): renderiza `plano.coberturas` como lista de strings

## Correção (3 pontos de mudança)

### 1. Adicionar JOIN na query de planos (`usePlanosCotacao.ts` ~L117)

Alterar o `select` da query `planos_cotacao` para incluir `planos_beneficios` com JOIN em `benefits`:

```sql
*, product_lines:product_line_id (...),
planos_beneficios (*, benefits:benefit_id (id, name, category))
```

### 2. Substituir `plano.coberturas` pelo mapeamento relacional (`usePlanosCotacao.ts` ~L527)

Em vez de `Array.isArray(plano.coberturas)`, mapear `plano.planos_beneficios` ordenado por `display_order`:

```ts
const beneficiosOrdenados = (plano.planos_beneficios || [])
  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  .map(pb => pb.custom_text || pb.benefits?.name || 'Benefício');
```

### 3. Interface `PlanoCotacao` — tipo `coberturas` permanece `string[]`

A interface `PlanoCotacao` já usa `coberturas: string[]`, então o componente `PlanoCardCotacao.tsx` não precisa de alteração — ele continuará recebendo um array de strings, mas agora preenchido pela fonte correta.

## Impacto

- Fonte única de verdade: `planos_beneficios` + `benefits`
- Ordenação por `display_order`
- Benefícios customizados (`custom_text`) respeitados
- Nenhuma alteração nos componentes de UI
- Compatibilidade mantida com o sistema de exclusão por categoria (`coberturasRemovidas`)

