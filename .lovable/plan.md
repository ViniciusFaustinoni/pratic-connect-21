

## Paginação incremental no Histórico de Vínculo

### Diagnóstico

`useHistoricoVinculoFiltrado` hoje busca em uma única query com `limit 200` e exibe um aviso de truncamento. Em rastreadores com muito histórico, o usuário não consegue ver registros antigos e a lista de 200 itens já é pesada de rolar.

### Mudanças

**A. `src/hooks/useHistoricoVinculoFiltrado.ts` — virar `useInfiniteQuery`**

- Trocar `useQuery` por `useInfiniteQuery` do `@tanstack/react-query`.
- Tamanho de página: `PAGE_SIZE = 25`.
- Paginação por **keyset** em `created_at` (mais robusto que offset com filtros): cada página usa `.lt('created_at', cursor)` quando há `pageParam`, mantendo `.order('created_at', { ascending: false }).limit(PAGE_SIZE + 1)`.
  - Se vier `PAGE_SIZE + 1` linhas → existe próxima página; o cursor é o `created_at` do último item retido (descarta o extra).
  - Se vier `≤ PAGE_SIZE` → `hasNextPage = false`.
- Retornar `{ items, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading }` (achatar páginas internamente para o componente continuar consumindo `items`).
- `queryKey` inclui todos os filtros; mudar filtro reseta a paginação naturalmente.
- Remover a flag `truncated` (não faz mais sentido com paginação).

**B. `src/components/rastreadores/HistoricoVinculoSection.tsx`**

- Consumir o novo formato do hook.
- Remover o aviso amarelo de "Mostrando os últimos 200 registros".
- Contador no badge: mostrar `items.length` + sufixo `+` quando `hasNextPage`.
- Adicionar no fim da lista um botão **"Carregar mais"** (`Button variant="outline"`, full width, com ícone de chevron) que só aparece quando `hasNextPage`. Estado de loading do botão usa `isFetchingNextPage` (texto "Carregando…" + spinner).
- Auto-load opcional via `IntersectionObserver`: um `<div ref={sentinelRef} />` logo antes do botão dispara `fetchNextPage()` quando entra na viewport — UX de scroll infinito sem perder o botão como fallback acessível.
- Ao trocar qualquer filtro (placa/período), o React Query recria a query (novo `queryKey`) e o scroll/contador volta ao zero — comportamento esperado.

### Arquivos editados

- `src/hooks/useHistoricoVinculoFiltrado.ts` — migrar para `useInfiniteQuery` + cursor por `created_at`.
- `src/components/rastreadores/HistoricoVinculoSection.tsx` — botão "Carregar mais" + sentinel IntersectionObserver; remover aviso de truncamento.

### O que NÃO muda

- Tabela `rastreadores_vinculo_historico`, RLS, trigger e filtros (placa/período/IDs) — idênticos.
- Integrações em `DetalhesRastreadorDialog` e `VeiculoDetalhesModal` — nenhuma alteração de chamada (a API do componente não muda).

### Riscos

- **Empate de `created_at`** (registros gravados no mesmo timestamp pelo trigger): keyset puro pode pular itens. Mitigação: o `.order` secundário fica em `id` desc e o cursor passa a ser composto `(created_at, id)` usando `.or('created_at.lt.X,and(created_at.eq.X,id.lt.Y)')`. Implemento já com o cursor composto para não voltar nessa tarefa.
- IntersectionObserver em modal com scroll interno: o `root` do observer é o container scrollável da modal. Se a detecção falhar em algum browser, o botão "Carregar mais" continua funcionando — fallback garantido.
- `placa` filtro com `or ilike` + paginação keyset: combina sem problemas (o cursor é aplicado depois dos filtros pelo Postgrest).

