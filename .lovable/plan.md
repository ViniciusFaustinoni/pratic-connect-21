

# Paginação na Lista de Rastreadores (Visão Geral)

## Problema
A query `useRastreadores` no hook `src/hooks/useRastreadores.ts` não usa `.range()` nem `.limit()`. O Supabase retorna no máximo 1.000 registros por padrão, então a lista mostra "(1000)" mesmo havendo 6.208+ cadastrados.

## Solução: Paginação server-side

### 1. Hook `useRastreadores` (`src/hooks/useRastreadores.ts`)
- Adicionar parâmetro `page` e `pageSize` (default 50) aos filtros
- Usar `{ count: 'exact' }` no `.select()` para obter o total real
- Aplicar `.range()` para paginação server-side
- Retornar `{ items, total, totalPages }` em vez de array direto

### 2. Página `Rastreadores.tsx` (`src/pages/monitoramento/Rastreadores.tsx`)
- Adicionar estado `page` ao componente
- Passar `page` nos filtros para `useRastreadores`
- Resetar página ao mudar filtros

### 3. Header `RastreadorListHeader` (`src/components/rastreadores/RastreadorListHeader.tsx`)
- Alterar `totalCount` para usar o `total` retornado pela query (count real do banco), não `rastreadores.length`

### 4. Grid/Table Views
- Adicionar componente de paginação (botões Anterior/Próximo + indicador de página) abaixo da lista
- Receber `page`, `totalPages`, `onPageChange` como props

### Resultado
- Total real exibido no header (ex: 6.208)
- Navegação por páginas com 50 itens por vez
- Performance melhorada (não carrega 1000+ de uma vez)

