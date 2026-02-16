
# Atualizar Card "Link do Evento" em Tempo Real

## Problema

O card "Link do Evento" usa o hook `useEventoLink` que faz apenas uma consulta inicial via `useQuery`. Quando o associado avanca nas etapas (auto vistoria, B.O., agendamento, pagamento), o card do analista nao atualiza -- so mostra o progresso novo apos recarregar a pagina.

## Solucao

Adicionar uma subscription Supabase Realtime no hook `useEventoLink` para escutar mudancas na tabela `sinistro_evento_links` filtradas pelo `sinistro_id`. Quando o associado completa uma etapa (e a edge function atualiza `etapa_atual`), o card reflete instantaneamente.

### Arquivo: `src/hooks/useEventoLink.ts`

1. Importar `useEffect` e `useQueryClient` (queryClient ja existe)
2. Adicionar um `useEffect` com subscription realtime na tabela `sinistro_evento_links`, filtrando por `sinistro_id`
3. Ao receber qualquer evento (INSERT/UPDATE), invalidar as queries `['evento-link', sinistroId]` e `['evento-contato', sinistroId]`
4. Cleanup: remover o canal ao desmontar ou quando `sinistroId` mudar

```typescript
useEffect(() => {
  if (!sinistroId) return;

  const channel = supabase
    .channel(`evento-link-realtime-${sinistroId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sinistro_evento_links',
        filter: `sinistro_id=eq.${sinistroId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['evento-link', sinistroId] });
        queryClient.invalidateQueries({ queryKey: ['evento-contato', sinistroId] });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [sinistroId, queryClient]);
```

## Resultado Esperado

- Quando o associado completa a Etapa 1 (Auto Vistoria), o card muda de "Etapa 0/3" para "Etapa 1/3" automaticamente
- A barra de progresso e o label da etapa atualizam em tempo real
- O status do link (ativo/completado) tambem reflete instantaneamente
- Nenhuma necessidade de recarregar a pagina

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useEventoLink.ts` | Adicionar subscription realtime para `sinistro_evento_links` com invalidacao automatica de cache |
