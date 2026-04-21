

## Fase 3 — Realtime cirúrgico

Objetivo: parar de invalidar queries amplas via `predicate` e eliminar a combinação polling + realtime na mesma chave, reduzindo refetches duplicados que pressionam Auth/PostgREST.

### Mudanças

#### 1. `src/hooks/useFilasRealtime.ts`
Hoje invalida via `predicate` qualquer query cuja chave começa com `instalac` ou `vistoria`, o que dispara dezenas de refetches a cada INSERT/UPDATE.

- Trocar `predicate` por invalidações de chaves exatas e conhecidas:
  - `['instalacoes']`, `['instalacoes-contagem']`, `['instalador-instalacoes']`
  - `['vistorias']`, `['vistorias-contagem']`
- Filtrar handler por `eventType` relevante (ignorar `UPDATE` puramente de campos não usados em listas de fila — invalidar só em INSERT/DELETE e em UPDATE com mudança de `status`/`data_agendada`).
- Toast só em INSERT (mantém comportamento), sem alterar UX.

#### 2. `src/hooks/useRotasRealtime.ts`
Aplicar mesmo padrão: substituir invalidações amplas por chaves exatas (`['rotas']`, `['rota-detalhes']`, `['rotas-ativas']`) e ignorar updates irrelevantes.

#### 3. Eliminar polling + realtime sobrepostos
Quando uma query já é invalidada por canal realtime, remover o `refetchInterval` curto da mesma chave. Auditoria e ajustes:

| Hook | Hoje | Ação |
|---|---|---|
| `useFilaServicos.ts` | realtime + `refetchInterval: 30000` | remover polling (manter só realtime + `refetchOnWindowFocus`) |
| `useInstalacoes.ts` (após Fase 2 ainda tem poll) | realtime via `useFilasRealtime` + poll | aumentar `refetchInterval` para `false` quando realtime ativo OU manter fallback longo (5min) |
| `useChamadosRealtime` consumidores | realtime + polls em `chamados-*` | remover polls curtos das mesmas chaves |
| `useNotificacoesVendas` (lista) | realtime INSERT + sem poll | OK, manter |
| `useLeadsRealtime` consumidores | realtime + alguns polls | remover polls onde já há canal |

Regra geral aplicada: se a chave é invalidada por realtime, `refetchInterval` vira `false` (ou ≥ 5min como fallback de segurança), e `refetchOnWindowFocus: true` cobre reconexão.

#### 4. Reduzir invalidações em `useNotificacoesRealtime.ts`
Já usa chaves específicas — apenas garantir que NÃO há `predicate` e que toast não dispara fetch adicional. Sem mudança funcional, só revisão.

#### 5. Realtime sob demanda (parcial)
Sem mover montagem global agora (fora do escopo da Fase 3 mínima), mas adicionar guard para não montar canais quando `user` ainda não carregou — evita canais órfãos durante o boot do AuthContext.

### Arquivos editados
- `src/hooks/useFilasRealtime.ts` — remover predicate, chaves exatas, filtro por eventType
- `src/hooks/useRotasRealtime.ts` — mesmo tratamento
- `src/hooks/useFilaServicos.ts` — remover `refetchInterval: 30000`
- `src/hooks/useInstalacoes.ts` — remover/alongar polls que coincidem com realtime
- `src/hooks/useChamadosRealtime.ts` — confirmar chaves exatas (já está bom, só revisar)
- consumidores de `chamados-*` com polling curto — alongar/remover

### Critérios de aceitação
1. Login continua funcionando como na Fase 1.
2. Inserir uma nova instalação dispara refetch SOMENTE das chaves de instalações (verificável no devtools do React Query).
3. Não há duas fontes (poll + realtime) atualizando a mesma `queryKey`.
4. Toasts de fila/rota continuam aparecendo em INSERT.
5. Volume de requests no painel de rede cai visivelmente em telas de monitoramento ociosas.

### Fora de escopo (fica para Fase 4)
- Mover canais realtime globais para montagem por rota.
- Medir consumo real via `analytics_query` e decidir upgrade de plano.

