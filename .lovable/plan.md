## Reordenar colunas da Fila em Relatos de Erros

A aba "Fila" exibe quatro colunas com a ordem atual: Aberto → Crítico → Em tratamento → Concluído. O usuário pediu que "Crítico" apareça depois de "Concluído".

### Mudança
Em `src/pages/diretoria/RelatosErros.tsx` (linha 39), alterar a constante `ORDEM_FILA` para:

```ts
const ORDEM_FILA: ErrorReportStatus[] = ['aberto', 'em_tratamento', 'concluido', 'critico'];
```

Nova ordem visual da Fila: Aberto → Em tratamento → Concluído → Crítico.

### Fora de escopo
- Cards de contadores no topo (linha 161) e o Select de filtro de status: a ordem permanece como está, pois o pedido é específico da aba "Fila". Posso ajustar também se desejar.