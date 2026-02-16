
# Atualizar Lista de Sinistros em Tempo Real

## Problema

A pagina `SinistrosList.tsx` (lista de eventos para o analista) usa apenas `useQuery` para buscar sinistros. Nao existe nenhuma subscription realtime, entao quando a IA cria um novo sinistro, a lista so atualiza ao recarregar a pagina manualmente.

## Solucao

Adicionar uma subscription Supabase Realtime na pagina `SinistrosList.tsx` que escuta INSERTs, UPDATEs e DELETEs na tabela `sinistros` e invalida a query automaticamente.

### Arquivo: `src/pages/eventos/SinistrosList.tsx`

Adicionar um `useEffect` com subscription realtime que:
- Escuta eventos `INSERT`, `UPDATE` e `DELETE` na tabela `sinistros`
- Invalida a queryKey `['sinistros-list']` (ou a key usada no componente) ao receber qualquer mudanca
- Remove o canal ao desmontar o componente

```typescript
// Adicionar no componente principal de SinistrosList:
useEffect(() => {
  const channel = supabase
    .channel('sinistros-list-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sinistros' },
      () => {
        queryClient.invalidateQueries({ queryKey: ['sinistros-list'] });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [queryClient]);
```

Sera necessario verificar a queryKey exata usada no fetch de sinistros dentro do componente e usar a mesma key na invalidacao.

## Resultado Esperado

- Quando a IA criar um novo sinistro, ele aparecera automaticamente na lista sem necessidade de atualizar a pagina
- Mudancas de status tambem serao refletidas em tempo real
- Exclusoes tambem serao refletidas

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistrosList.tsx` | Adicionar subscription realtime para tabela `sinistros` com invalidacao automatica de cache |
