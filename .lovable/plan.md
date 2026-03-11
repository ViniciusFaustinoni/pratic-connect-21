

# Fix: Planos sem filtro de condição do veículo na cotação

## Problemas encontrados

### 1. `blocked_categories` não é buscado do banco
Em `usePlanosCotacao.ts` linha 93, a query de `product_lines` seleciona:
```
slug, vehicle_type, sort_priority, requires_recent_year, gradient_class
```
**Falta `blocked_categories`**. O filtro na linha 211 sempre recebe `[]`, então planos como Select/Lançamento nunca são bloqueados para veículos de leilão, chassi remarcado, etc.

### 2. `isCoberturaRemovida` chamado sem dados de exclusão
Em `CotacaoFormDialog.tsx` linha 1683:
```typescript
const isRemovida = isCoberturaRemovida(cobertura, categoria);
```
A função exige um terceiro parâmetro `exclusions` para funcionar. Sem ele, retorna sempre `false` — coberturas excluídas nunca são marcadas visualmente.

## Correções

### Arquivo 1: `src/hooks/usePlanosCotacao.ts`
**Linha 93** — Adicionar `blocked_categories` ao select de `product_lines`:
```
product_lines:product_line_id (slug, vehicle_type, sort_priority, requires_recent_year, gradient_class, blocked_categories)
```

### Arquivo 2: `src/components/cotacoes/CotacaoFormDialog.tsx`
**Linha 1683** — Passar as exclusões do hook para a função. O hook `usePlanosCotacao` já busca `benefitExclusions` internamente, mas o componente precisa dos dados separadamente. Duas opções:

- Usar `plano.coberturasRemovidas` que já vem calculado pelo hook (mais simples):
```typescript
const isRemovida = plano.coberturasRemovidas.some(
  cr => cr.toLowerCase().includes(cobertura.toLowerCase())
);
```

Isso aproveita o campo `coberturasRemovidas` que o hook já calcula via `getCoberturasRemovidasDinamico` na linha 307.

### Resumo
- 1 campo faltando no select → planos proibidos aparecem para veículos restritos
- 1 chamada de função sem parâmetro → exclusões de cobertura invisíveis
- 2 arquivos, 2 linhas alteradas
