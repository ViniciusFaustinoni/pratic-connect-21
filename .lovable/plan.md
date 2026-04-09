

## Plano: Corrigir rastreadores em porte nao aparecendo para instalador

### Diagnostico
Os dados existem no banco (2 rastreadores com `portador_id` do `[TESTE] Vistoriador` e `status = 'estoque'`). As politicas RLS parecem permitir acesso. O problema provavel e um dos seguintes:

1. **Cache stale do React Query** — a query `rastreadores-meu-porte` pode ter sido cacheada como vazia em uma sessao anterior e nao refetch ao entrar no checklist
2. **Erro silencioso** — o hook nao captura nem exibe erros da query, entao falhas de RLS ou rede passam despercebidas
3. **Profile ainda nao carregado** — timing entre auth context e a query

### Correcoes

**1. `src/hooks/useRastreadoresPortador.ts`**
- Adicionar `refetchOnMount: 'always'` para garantir dados frescos ao abrir o checklist
- Adicionar `retry: 2` para resiliencia em conexoes instáveis (mobile)
- Logar erro no console para facilitar debug futuro

```typescript
return useQuery({
  queryKey: ['rastreadores-meu-porte', profile?.id],
  enabled: !!profile?.id,
  refetchOnMount: 'always',
  retry: 2,
  queryFn: async (): Promise<RastreadorEmPorte[]> => {
    const { data, error } = await supabase
      .from('rastreadores')
      .select('id, codigo, imei, numero_serie, plataforma')
      .eq('portador_id', profile!.id)
      .eq('status', 'estoque')
      .order('codigo');

    if (error) {
      console.error('[useRastreadoresDoPortador] Erro ao buscar:', error);
      throw error;
    }
    console.log('[useRastreadoresDoPortador] Encontrados:', data?.length, 'para portador', profile!.id);
    return (data || []) as RastreadorEmPorte[];
  },
});
```

**2. `src/pages/instalador/InstaladorChecklist.tsx`**
- Capturar o `error` retornado pelo hook: `const { data: rastreadoresEmPorte, isLoading: isLoadingRastreadores, error: erroRastreadores } = useRastreadoresDoPortador();`
- Na UI, quando houver erro, mostrar mensagem informativa em vez de "nenhum em porte" (para que o usuario saiba que houve falha e pode tentar recarregar)
- Adicionar botao "Tentar novamente" que faz refetch

### Resultado
- Dados frescos sempre ao abrir o checklist
- Erros visiveis no console e na UI
- Botao de retry para o instalador caso haja falha de rede

### Arquivos
- `src/hooks/useRastreadoresPortador.ts`
- `src/pages/instalador/InstaladorChecklist.tsx`

