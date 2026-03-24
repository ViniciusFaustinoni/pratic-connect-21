

# Alterar historico do app do vistoriador para mostrar o mes inteiro

## Problema
O historico de tarefas no app do vistoriador (`InstaladorTarefas.tsx`) busca apenas os ultimos 7 dias. O usuario quer ver todas as tarefas do mes atual.

## Alteracoes

### 1. `src/hooks/useTarefaAtual.ts` — `useTarefasHistorico`
- Trocar o parametro `dias: number = 7` por logica que calcula o inicio do mes atual (`startOfMonth`)
- Usar `startOfMonth(new Date())` como `dataLimite` em vez de `new Date() - dias`
- Atualizar a queryKey para refletir o mes

### 2. `src/pages/instalador/InstaladorTarefas.tsx`
- Remover o argumento `7` da chamada `useTarefasHistorico(7)` → `useTarefasHistorico()`
- Atualizar a mensagem de estado vazio de "últimos 7 dias" para "neste mês"

### 3. `src/hooks/usePerformanceSemanalCoordenador.ts` (opcional — dashboard do coordenador)
- Manter como esta, pois e um grafico semanal separado do historico do vistoriador

