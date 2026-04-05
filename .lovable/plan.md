

# Plano: Corrigir carregamento de veículos na Base Antiga

## Problema
A query de veículos da Base Antiga está dando timeout no PostgREST. Ela faz um `INNER JOIN` com `associados` + `LEFT JOIN` com `rastreadores`, ordena por `created_at` (sem índice), e pede `count: 'exact'` -- tudo isso sobre 9.611 registros.

## Solução

### 1. Criar índice em `veiculos.created_at` (migration)
Adicionar `CREATE INDEX idx_veiculos_created_at ON public.veiculos (created_at DESC)` para otimizar a ordenação.

### 2. Otimizar a query em `src/hooks/useBaseAntiga.ts` (função `useBaseAntigaVeiculos`)
- **Separar a contagem**: Fazer uma query `{ count: 'exact', head: true }` separada (sem selecionar dados nem joins pesados) para obter o total.
- **Simplificar o select da listagem**: Remover `{ count: 'exact' }` da query principal de dados. Manter os joins para associado e rastreador, mas sem pedir contagem.
- Isso segue o padrão já documentado no projeto (pagination-counting-strategy-v2).

### Resultado esperado
- A contagem executa em milissegundos (query leve, head-only).
- A listagem paginada com `.range()` retorna rápido com o novo índice.
- Os veículos aparecem corretamente na aba.

