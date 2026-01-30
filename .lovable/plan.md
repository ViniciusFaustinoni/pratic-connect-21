
# Plano: Corrigir Atualizacao em Tempo Real na Area do Cliente

## Problema Identificado

A area publica do cliente que mostra "Em Analise Cadastral" nao se atualiza automaticamente quando o analista de cadastro aprova a proposta para "Roubo e Furto".

## Causa Raiz

O hook `useCotacaoContratacao.ts` possui um listener Realtime que detecta mudancas na tabela `associados`, porem quando a mudanca e detectada:

```typescript
// Codigo atual - linha 217-220
(payload) => {
  console.log('[CotacaoContratacao] Realtime: associado atualizado:', payload);
  refetch(); // <- So refaz a query "cotacao-contratacao"
}
```

O problema e que:
1. `refetch()` rebusca apenas a query `cotacao-contratacao` (cotacoes)
2. O `associadoStatus` vem da query `contrato-publico-fallback` (contratos)
3. Essa segunda query NAO e invalidada no callback

### Fluxo do Problema

```text
Analista aprova       associados.status    Realtime detecta    refetch() rebusca
  proposta      --->  muda para 'ativo' --> mudanca no BD  --> apenas cotacao
                                                               |
                                                               v
                                            contrato-publico-fallback NAO rebusca
                                                               |
                                                               v
                                            associadoStatus fica com valor antigo
                                                               |
                                                               v
                                            Tela permanece em "Em Analise Cadastral"
```

## Solucao

Modificar o callback do listener Realtime para tambem invalidar a query `contrato-publico-fallback`:

```typescript
// Codigo corrigido
.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'associados',
    filter: `id=eq.${associadoId}`,
  },
  (payload) => {
    console.log('[CotacaoContratacao] Realtime: associado atualizado:', payload);
    // Invalidar AMBAS as queries para garantir atualizacao
    refetch();
    queryClient.invalidateQueries({ queryKey: ['contrato-publico-fallback', token] });
  }
)
```

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useCotacaoContratacao.ts` | Adicionar invalidacao da query `contrato-publico-fallback` no callback do Realtime |

## Alteracao Detalhada

No useEffect do Realtime (linhas 188-230), modificar o callback para:

1. Continuar chamando `refetch()` para a query principal
2. Adicionar `queryClient.invalidateQueries()` para a query `contrato-publico-fallback`

Isso garantira que quando o analista atualizar o `associados.status`, AMBAS as queries serao recarregadas, e o `associadoStatus` sera atualizado corretamente.

## Impacto

- A tela do cliente (`CotacaoContratacao.tsx`) atualizara automaticamente quando o analista aprovar a proposta
- O redirecionamento para `/acompanhar/:token` funcionara em tempo real (quando `associadoStatus` mudar para `em_analise` ou `ativo`)
- O cliente nao precisara atualizar a pagina manualmente

## Tempo Estimado

~5 minutos
