## Objetivo

Resolver a percepção de “nenhuma cotação aparece no mobile” na tela `/vendas/cotacoes`. A causa real é a barra de filtros do desktop sendo reaproveitada no mobile: ocupa toda a primeira dobra, embaralha estados ativos e esconde a lista, dando impressão de tela vazia.

## O que muda (somente UI mobile, < 768px)

1. **Barra de filtros condensada num único botão "Filtros"**
   - No mobile, esconder os selects soltos (Status, Período, Etapa do funil, Data, Consultor, Sem Lead).
   - Mostrar apenas: campo de busca + botão `Filtros` com badge mostrando a contagem de filtros ativos.
   - O botão abre um `Sheet` lateral (já usado no projeto) contendo todos os filtros atuais, um botão "Aplicar" e um "Limpar tudo".
   - Desktop (≥ 768px) permanece exatamente como está hoje.

2. **Banner de filtros ativos sempre visível no topo da lista mobile**
   - Quando `hasActiveFilters` for verdadeiro, mostrar uma faixa fina acima da lista listando os filtros ativos como chips removíveis (ex.: `Etapa: Escolhendo plano ✕`, `Consultor: Maria ✕`).
   - Clicar no `✕` de cada chip remove só aquele filtro.
   - Mantém o aviso atual “Você tem N cotações ocultadas pelos filtros” + botão Limpar.

3. **Card de total no topo (mobile) reforçado**
   - O card já existente (`funilCounts.total`) passa a mostrar também a contagem da aba ativa: “339 em andamento · 0 finalizadas”.
   - Assim o usuário entende rapidamente onde estão as cotações antes mesmo de mexer em filtro.

4. **Aba Finalizadas com empty-state explicativo**
   - Quando `cotacoesFinalizadasTotal === 0` (sem filtros), trocar o texto genérico “Nenhuma cotação encontrada” por: “Ainda não há cotações finalizadas (aceitas, recusadas ou expiradas).”
   - Evita o usuário pensar que é bug.

5. **Reset defensivo de filtros ao montar a página**
   - Garantir que `statusFilter`, `mesFilter`, `dataFilter`, `consultorFilter`, `etapaFunilFilter`, `filtroOrfas` partam sempre de `'all' / undefined / false` no mount (já é o caso, mas vamos blindar contra qualquer persistência futura via state global).

## O que NÃO muda

- Hook `useCotacoesPaginadas`, RPC `useCotacoesFunilCounts`, scopes RLS, lógica de permissões — **nada de backend ou query**.
- `CotacoesMobileList` segue igual; só recebe a mesma lista filtrada.
- Desktop: zero mudança visual ou de comportamento.

## Arquivos afetados

- `src/pages/vendas/Cotacoes.tsx` — substituir o bloco de filtros (linhas ~866‑1011) por: render desktop atual + render mobile com botão `Filtros` + Sheet.
- Novo componente: `src/components/cotacoes/CotacoesFiltrosSheet.tsx` — encapsula os controles dentro de um `Sheet` para reuso e legibilidade.
- Novo componente: `src/components/cotacoes/CotacoesActiveFiltersChips.tsx` — chips removíveis acima da lista.

## Detalhes técnicos

- Usar `useIsMobile()` (já existe em `src/hooks/use-mobile.tsx`) para alternar entre os dois layouts da barra.
- `Sheet` do shadcn (`src/components/ui/sheet.tsx`) com `side="bottom"` em mobile (mais natural num thumbzone de 411px).
- A contagem de ativos reusa o cálculo já existente em `Cotacoes.tsx` linha 1007.
- Nenhuma alteração em `permissions`, `viewScope` ou estado de `vendedores`.

## Critério de aceite

- Em viewport ≤ 411px, a primeira dobra mostra: header + busca + botão `Filtros` + card de totais + primeira cotação da lista.
- Filtros ativos ficam sempre evidentes via chips, mesmo com o sheet fechado.
- Aba Finalizadas vazia explica o motivo.
- Desktop idêntico ao atual.
