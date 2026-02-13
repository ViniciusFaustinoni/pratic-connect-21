
# Corrigir erro "Erro ao carregar trajeto" no TrajetoSinistroCard

## Diagnostico

A edge function `rastreador-historico` esta funcionando corretamente -- os logs mostram que retorna `{ success: true, trajeto: [], total: 0 }` com status 200. Porem, o componente `TrajetoSinistroCard` exibe "Erro ao carregar trajeto".

Causas provaveis:
- O `supabase.functions.invoke` pode retornar um erro transitorio (timeout, cold start, relay error) que fica cacheado pelo React Query sem possibilidade de retry manual
- A mensagem de erro generica nao ajuda a diagnosticar o problema real
- Nao ha mecanismo de retry automatico nem botao de tentar novamente

## Alteracoes

| Arquivo | Descricao |
|---|---|
| `src/components/sinistros/TrajetoSinistroCard.tsx` | Melhorar tratamento de erros e adicionar retry |

## Detalhes tecnicos

### 1. Adicionar retry automatico no useQuery (linha 107-122)
Configurar `retry: 2` e `retryDelay: 2000` para tentar novamente automaticamente em caso de falha transitoria (cold start, timeout).

### 2. Melhorar tratamento de erro no queryFn (linhas 110-119)
Adicionar try/catch ao redor do `supabase.functions.invoke` para capturar erros de rede/relay e fornecer mensagens mais claras. Tambem adicionar um log do erro para facilitar debug futuro.

### 3. Exibir mensagem de erro real + botao "Tentar novamente" (linhas 253-259)
Substituir a mensagem generica "Erro ao carregar trajeto" por:
- A mensagem real do erro (`error.message`)
- Um botao "Tentar novamente" que chama `refetch()` da query

```typescript
// Adicionar refetch ao useQuery
const { data: historico, isLoading, error, refetch } = useQuery({
  queryKey: [...],
  queryFn: async () => {
    try {
      const { data, error } = await supabase.functions.invoke('rastreador-historico', {
        body: { ... },
      });
      if (error) throw new Error(error.message || 'Erro na comunicacao');
      if (!data?.success) throw new Error(data?.error || 'Resposta invalida');
      return data;
    } catch (err) {
      console.error('[TrajetoSinistroCard] Erro:', err);
      throw err;
    }
  },
  retry: 2,
  retryDelay: 2000,
  enabled: !!rastreador?.id,
});

// No bloco de erro (linhas 253-259):
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertDescription className="flex items-center justify-between">
    <span>{error?.message || 'Erro ao carregar trajeto'}</span>
    <Button variant="outline" size="sm" onClick={() => refetch()}>
      Tentar novamente
    </Button>
  </AlertDescription>
</Alert>
```

Essas mudancas garantem que:
- Erros transitorios (cold start, timeout) sao retentados automaticamente
- O usuario ve a mensagem real do erro para facilitar diagnostico
- Ha um botao para tentar novamente manualmente
- Logs no console ajudam a identificar o problema exato
