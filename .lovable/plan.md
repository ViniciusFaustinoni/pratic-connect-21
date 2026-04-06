

# Plano: Filtro "Sem Rastreador" na Base Antiga - Veículos

## O que muda para o usuário
Um botão de filtro ao lado da barra de busca permitirá mostrar apenas veículos que **não possuem rastreador vinculado**. Ao ativar, a lista e a contagem se atualizam automaticamente.

## Implementação

### 1. Expandir interface de filtros (`src/hooks/useBaseAntiga.ts`)
- Adicionar `semRastreador?: boolean` ao `BaseAntigaFilters`.
- Quando `semRastreador` estiver ativo, a estratégia muda: buscar IDs de veículos que **possuem** rastreador na tabela `rastreadores`, e usar `.not('id', 'in', (...))` ou, mais eficientemente, fazer um LEFT JOIN e filtrar onde `rastreador` é nulo **no lado do cliente** após o fetch (já que o PostgREST não suporta `IS NULL` em joins facilmente).
- Abordagem mais simples e performática: filtrar client-side os resultados paginados onde `v.rastreador === null`. Porém isso quebra a paginação.
- **Abordagem correta**: Usar uma query separada quando o filtro está ativo — buscar `veiculo_id` da tabela `rastreadores`, e aplicar `.not('id', 'in', (...ids))` na query de veículos. Limitação: se houver muitos rastreadores, a lista de IDs pode ser grande. Alternativa: criar uma view ou RPC no banco.
- **Abordagem mais limpa**: Criar uma RPC `veiculos_sem_rastreador` que faz um `LEFT JOIN` eficiente no banco e retorna os IDs, ou simplesmente usar a lógica inversa — buscar todos os `veiculo_id` da tabela `rastreadores` (são poucos, ~centenas) e excluí-los.

### 2. Lógica no hook (`src/hooks/useBaseAntiga.ts`)
- Quando `semRastreador = true`:
  - Buscar todos os `veiculo_id` distintos da tabela `rastreadores` (query leve, poucos registros).
  - Aplicar `.not('id', 'in', '(id1,id2,...)')` nas queries de contagem e dados.

### 3. UI — Botão de filtro (`src/pages/cadastro/BaseAntiga.tsx`)
- Adicionar estado `semRastreador` (boolean, default `false`).
- Renderizar um botão toggle ao lado do input de busca (ex: `<Button variant={semRastreador ? 'default' : 'outline'}>Sem Rastreador</Button>`).
- Passar `{ search: vDebouncedSearch, semRastreador }` para o hook.
- Resetar página ao alternar filtro.

## Arquivos modificados
- `src/hooks/useBaseAntiga.ts` — expandir filtros e lógica de query
- `src/pages/cadastro/BaseAntiga.tsx` — adicionar botão toggle de filtro

