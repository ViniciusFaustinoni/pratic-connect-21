
# Ocultar Vistorias Concluidas da Tela do Regulador

## Problema

Vistorias ja concluidas continuam aparecendo na lista do regulador, mesmo apos finalizadas. O regulador so precisa ver vistorias pendentes (agendadas ou em andamento).

## Solucao

Filtrar vistorias concluidas e canceladas na query do hook `useVistoriasEvento`, excluindo-as quando o filtro de status for "todas". A aba "Concluidas" continuara disponivel caso o regulador queira consultar o historico.

## Alteracoes

### `src/hooks/useVistoriasEvento.ts`

Na query principal, quando `status === 'todas'`, adicionar filtro para excluir vistorias com status `concluida` e `cancelada`:

```typescript
// Filtro de status
if (status === 'todas') {
  query = query.in('status', ['agendada', 'em_andamento']);
} else {
  query = query.eq('status', status);
}
```

Isso garante que, por padrao, o regulador so veja vistorias que precisam de acao (agendadas e em andamento). Se ele clicar em "Concluidas", vera o historico normalmente.
