## Objetivo

Paginar a renderização das abas **Coberturas** e **Benefícios** em Diretoria › Gestão Comercial › Coberturas e Benefícios para não jogar 3.092 + 1.906 itens no DOM. Busca, ordenação e filtro de atribuição continuam varrendo o catálogo inteiro.

## Por que funciona naturalmente

`useCoberturas` e `useBenefits` (em `src/hooks/usePlans.ts`) já fazem paginação no PostgREST e devolvem o catálogo completo em memória. O `filterAndSort` do `CatalogoCoberturasBeneficios.tsx` já roda sobre todo o array. Só falta paginar o **display**.

## Mudanças

Arquivo único: `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx`

1. Estado novo, por aba:
   - `cobPage` / `benPage` (default 1)
   - `cobPageSize` / `benPageSize` (default 50, com seletor 25 / 50 / 100 / 200)

2. Pipeline por aba (mantém ordem atual):
   ```
   coberturas → filterAndSort(busca, sort, attrFilter) → array filtrado
                                                     ├─ count para o rodapé
                                                     └─ .slice((page-1)*size, page*size) → ItemList
   ```

3. Resetar `page` para 1 sempre que `search`, `sort`, `attrFilter` ou `pageSize` mudarem (`useEffect` com essas deps).

4. Rodapé de paginação abaixo do `ItemList` em cada aba:
   - "Mostrando X–Y de N" (N = total após filtros)
   - Seletor de page size
   - Botões: « primeira, ‹ anterior, "Página X de Y", próxima ›, última »
   - Esconde rodapé quando N ≤ pageSize

5. Quando `highlightCobId` / `highlightBenId` for ativado por criação, calcular a página onde o item caiu (índice no array filtrado ÷ pageSize) e pular pra ela, pra manter o highlight visível.

## Fora do escopo

- Não mudar `useCoberturas` / `useBenefits` (já paginam o fetch).
- Não mexer na aba "Atribuição".
- Não mexer no componente legado `BeneficiosCoberturas.tsx`.
- Sem URL params (paginação só client-state).
