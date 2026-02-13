

# Resolver rate limiting do Supabase (ThrottlerException: Too Many Requests)

## Causa raiz

O sistema tem requisicoes demais ao Supabase rodando simultaneamente:

- 15+ canais Realtime (cada um abre conexao WebSocket e dispara queries)
- 41+ queries com polling automatico (refetchInterval entre 10s e 60s)
- Invalidacoes em cascata: uma unica acao pode invalidar 5-10 queries de uma vez
- No reload (deploy), TUDO dispara ao mesmo tempo

O Supabase tem limite de ~100 requisicoes/segundo por cliente. O sistema ultrapassa isso no momento do carregamento.

## Solucao em 3 frentes

### Frente 1: Reduzir polling agressivo

Muitas queries usam `refetchInterval` desnecessariamente, porque ja tem Realtime escutando a mesma tabela.

| Hook | Intervalo atual | Acao |
|---|---|---|
| `useEncaixesUrgentes` | 10s | Remover (ja tem Realtime em `servicos`) |
| `useCotacaoContratacao` | 10s | Aumentar para 30s |
| `usePropostasPendentes` | 30s | Remover (ja tem Realtime em `cotacoes`) |
| `useVistoriadoresRealtime` | 30s | Remover (ja tem Realtime no mesmo hook) |
| `useDashboardCoordenador` | 30s | Aumentar para 60s |
| `useAgendamentoBase` | 30s | Aumentar para 60s |
| `useSinistroDetalhes` (2 queries) | 30s | Aumentar para 60s |
| `useServicos` | 30s | Remover (ja tem Realtime) |
| `DetalhesRastreadorDialog` (4 queries) | 30s cada | Remover todas (so precisa quando dialog aberto, e ja busca no open) |

### Frente 2: Consolidar invalidacoes em cascata

Em vez de invalidar 5-10 queries individualmente, agrupar com prefixo comum e usar `queryKey` parcial.

Exemplo atual (dispara 5 requests):
```
queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
queryClient.invalidateQueries({ queryKey: ['instalacao'] });
queryClient.invalidateQueries({ queryKey: ['instalacoes-metricas'] });
queryClient.invalidateQueries({ queryKey: ['instalacoes-contagem'] });
queryClient.invalidateQueries({ queryKey: ['instalacoes-dia'] });
```

Exemplo otimizado (dispara 1 invalidacao agrupada):
```
queryClient.invalidateQueries({ 
  predicate: (query) => {
    const key = query.queryKey[0] as string;
    return key?.startsWith('instalac');
  }
});
```

### Frente 3: Adicionar staleTime global para evitar refetch duplicado

No `QueryClient` global, definir `staleTime: 5000` (5 segundos) para que queries recentes nao sejam re-buscadas imediatamente ao serem invalidadas.

**Arquivo**: `src/App.tsx` ou onde o `QueryClient` e configurado.

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useEncaixesUrgentes.ts` | Remover refetchInterval |
| `src/hooks/usePropostasPendentes.ts` | Remover refetchInterval |
| `src/hooks/useVistoriadoresRealtime.ts` | Remover refetchInterval |
| `src/hooks/useServicos.ts` | Remover refetchInterval |
| `src/hooks/useCotacaoContratacao.ts` | Aumentar refetchInterval para 30s |
| `src/hooks/useDashboardCoordenador.ts` | Aumentar refetchInterval para 60s |
| `src/hooks/useAgendamentoBase.ts` | Aumentar refetchInterval para 60s |
| `src/hooks/useSinistroDetalhes.ts` | Aumentar refetchInterval para 60s |
| `src/components/monitoramento/estoque/DetalhesRastreadorDialog.tsx` | Remover refetchInterval (4 queries) |
| `src/hooks/useFilasRealtime.ts` | Consolidar invalidacoes com predicate |
| Arquivo do QueryClient (App.tsx ou similar) | Adicionar staleTime global de 5s |

## Resultado esperado

Reducao estimada de 40-60% no volume de requisicoes, eliminando o rate limiting durante navegacao e reloads.

