## Contexto

Diagnóstico inicial estava parcialmente desatualizado: realtime já está enxuto (só `cotacoes` + `cotacoes_historico`), throttle já em 3s, `count: 'estimated'` já em uso e logs já guardados por `isDev`. Restam 5 otimizações reais.

## Mudanças

### 1. Lazy-load `useVendedores` — `src/pages/vendas/Cotacoes.tsx`

Hoje (linha 150) chama `useVendedores()` sempre que a página monta, mesmo que o filtro de consultor nunca seja aberto. Adicionar opção `enabled` ao hook e disparar só quando: (a) `viewScope !== 'own'`, ou (b) o `Select` de filtro for aberto pela primeira vez (state `vendedoresFilterOpened`).

Arquivos: `src/pages/vendas/Cotacoes.tsx` + `src/hooks/useVendedores.ts` (adicionar `{ enabled }` repassado ao `useQuery`).

### 2. Joins pesados na lista — `src/hooks/useCotacoes.ts` (`fetchCotacoesCore`)

A coluna `instalacoes:instalacoes!instalacoes_cotacao_id_fkey(id, status, data_agendada)` raramente é exibida na linha da lista (é detalhe). Mover para uma 2ª query batch (`.in('cotacao_id', ids)`) condicional — só quando alguma linha precisar exibir badge de instalação. Mesma estratégia que já é usada para `profiles`.

`contratos→associados` também pode virar batch separado (igual a `profiles`), reduzindo o JSON do SELECT principal.

Resultado esperado: payload da query principal cai ~40%.

### 3. `staleTime: Infinity` na paginada quando realtime ativo — `useCotacoes.ts:322`

Como o realtime já invalida `['cotacoes']`, subir `staleTime` de 30s → `Infinity` na `useCotacoesPaginadas`. Eliminamos refetch automático em foco/intervalo, deixando o realtime ditar.

### 4. Eliminar round-trip extra de funil quando dados já vieram — `useCotacoes.ts`

Manter a RPC `cotacoes_funil_counts` mas: (a) aumentar `staleTime` para 60s; (b) `refetchOnWindowFocus: false`. Como contagens são aproximadas e o realtime invalida quando muda, não precisa refazer a cada foco.

### 5. Silenciar log "Mesmo usuário já carregado" — `src/contexts/AuthContext.tsx`

Trocar o `console.info` por log condicional `if (import.meta.env.DEV) ...` ou remover. Cosmético — limpa o console em produção sem alterar comportamento.

## Validação

1. Abrir `/vendas/cotacoes` como diretor → console limpo (sem mensagens de Auth/realtime em produção).
2. Network: a chamada `profiles?...` que hidrata vendedores **não** deve aparecer no load inicial — só ao abrir o filtro.
3. Payload da query `cotacoes?select=...` reduzido (sem o sub-objeto `instalacoes`).
4. Mudar status de uma cotação em outra aba → lista atualiza via realtime em < 3s.
5. Trocar de aba "Em andamento" ↔ "Finalizadas" → não dispara nova RPC `cotacoes_funil_counts` antes de 60s.

## Arquivos

- `src/hooks/useCotacoes.ts` (joins + staleTime + funil)
- `src/hooks/useVendedores.ts` (parâmetro `enabled`)
- `src/pages/vendas/Cotacoes.tsx` (lazy + state do filtro)
- `src/contexts/AuthContext.tsx` (log silencioso)

Sem mudanças de schema, sem migrations, sem refactor estrutural.
