
# Realtime para Fila de Chamados de Assistencia

## Problema

Quando um novo chamado e criado (via WhatsApp, App ou painel), a lista de chamados em `/assistencia/chamados` nao atualiza automaticamente. O operador precisa recarregar a pagina manualmente para ver novos chamados.

## Solucao

Criar um hook `useChamadosRealtime` que escuta mudancas na tabela `chamados_assistencia` via Supabase Realtime e invalida as queries relevantes automaticamente.

## Alteracoes

### 1. Criar hook `src/hooks/useChamadosRealtime.ts`

Hook que escuta eventos `INSERT`, `UPDATE` e `DELETE` na tabela `chamados_assistencia` e invalida as queries:
- `chamados-assistencia`
- `chamados-contadores`
- `chamados-ativos`
- `assistencia-estatisticas`

Seguira o mesmo padrao ja usado em `useFilasRealtime.ts` e `useContratosRealtime.ts`.

Tambem exibira um toast informativo quando um novo chamado for inserido ("Novo chamado na fila").

### 2. Usar o hook em `src/pages/assistencia/ChamadosList.tsx`

Adicionar `useChamadosRealtime()` no componente da lista de chamados para que a fila atualize em tempo real.

### 3. Usar o hook em `src/pages/assistencia/AssistenciaDashboard.tsx`

Tambem ativar no dashboard de assistencia para que os contadores e chamados ativos atualizem automaticamente.

## Detalhes Tecnicos

```text
// useChamadosRealtime.ts
- Canal: 'chamados-assistencia-realtime'
- Tabela: 'chamados_assistencia'
- Eventos: * (INSERT, UPDATE, DELETE)
- Ao receber evento: invalidar queries ['chamados-assistencia'], ['chamados-contadores'], ['chamados-ativos'], ['assistencia-estatisticas']
- Em INSERT: toast.info("Novo chamado de assistencia na fila")
```

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useChamadosRealtime.ts` | Novo hook de realtime para chamados |
| `src/pages/assistencia/ChamadosList.tsx` | Importar e usar `useChamadosRealtime()` |
| `src/pages/assistencia/AssistenciaDashboard.tsx` | Importar e usar `useChamadosRealtime()` |
