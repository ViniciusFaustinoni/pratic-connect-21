# Plano — Auto-atualização de "Documentos Pendentes"

## Diagnóstico

O sino é alimentado por `usePendenciasDocumentos` (`src/hooks/usePendenciasDocumentos.ts`) que:

1. Faz query em `documentos_solicitados` filtrando `status='pendente'`.
2. Assina Realtime no canal `pendencias-documentos-rt` para `INSERT/UPDATE/DELETE` em `documentos_solicitados` e invalida o cache no callback.

Verificações no banco:
- A tabela está na publication `supabase_realtime` ✅
- Quando o associado envia o doc no fluxo público (`DocumentosPendentesPublico.tsx`), o registro vai de `status='pendente'` → `'enviado'` (UPDATE) — Realtime deve disparar.

Pontos frágeis identificados que justificam o relato do usuário ("não atualiza sozinho"):

1. **Canal Realtime com nome fixo global** (`pendencias-documentos-rt`). Em HMR/StrictMode/duas abas montando o sino, podem ocorrer colisões silenciosas — uma das instâncias fica sem evento. Solução: sufixar com `profile.id` + um id estável por mount.
2. **Sem fallback de polling.** Se o WS do Realtime cair (rede, sleep do laptop, proxy), o badge fica preso até refresh manual. Solução: `refetchInterval` discreto (60s) + `refetchIntervalInBackground:false`.
3. **Sem `refetchOnWindowFocus`.** Voltando à aba não recarrega. Ligar.
4. **Sem visibilidade de falha de subscribe.** Hoje ignoramos o status do `subscribe()`. Logar `SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED` ajuda diagnóstico futuro.
5. **`staleTime: 30s`** não é problema (invalidate força refetch), mas combinado com a falta de polling vira ponto cego quando o Realtime falha.
6. **Listener escuta apenas `documentos_solicitados`.** Quando o monitoramento aprova o documento manualmente, o registro muda para `status='aprovado'` na mesma tabela — coberto. Nenhuma mudança fora dessa tabela impacta a lista.

Não há mudanças de schema/RLS necessárias — a publication já está correta e a RLS atual já permite que gestor/diretor/analista vejam updates dessas linhas (mesma RLS de SELECT).

## Mudanças (apenas em `src/hooks/usePendenciasDocumentos.ts`)

1. Adicionar ao `useQuery`:
   - `refetchInterval: 60_000`
   - `refetchIntervalInBackground: false`
   - `refetchOnWindowFocus: true`
2. Trocar o canal para `pendencias-documentos-rt-${profile.id}` (e gerar um sufixo aleatório por mount via `useRef`) para evitar colisão.
3. Capturar status do `subscribe((status) => console.log(...))` — apenas log, sem UI.
4. Manter o invalidate por prefixo `['pendencias-documentos']` (já correto).

## Fora de escopo

- Não mexer no componente `PendenciasDocumentosBell` (UI permanece igual; ele já reage ao `total` do hook).
- Não alterar RLS, edge functions, fluxo público de upload, nem aprovação de documentos.
- Não tocar em `usePropostasPendentes` / sidebar.

## Validação

- Abrir `/monitoramento/aprovacao-associados` e o sino, observar console: deve aparecer `[pendencias-documentos-rt] SUBSCRIBED`.
- Em outra aba (associado), enviar um doc pendente → badge deve cair em ≤2s sem refresh.
- Cortar Wi-Fi por 30s e religar → no máximo em 60s o polling reconcilia o badge.
