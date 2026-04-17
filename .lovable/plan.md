

## Bug

Banner "Sem internet — trabalhando offline" aparece para o técnico mesmo com internet funcionando perfeitamente.

## Causa raiz (confirmada por teste real)

`src/hooks/useOnlineStatus.ts` (linha 30) faz ping em `${supabaseUrl}/auth/v1/health` **sem enviar o header `apikey`**. Testei agora:

- Sem `apikey` → **HTTP 401** (`"No API key found in request"`)
- Com `apikey` → **HTTP 200**

Como `res.ok` é `false` quando o status é 401, o hook seta `online = false` a cada 30 segundos, mesmo o aparelho estando perfeitamente conectado. O `SyncStatusBanner` então mostra "Sem internet — trabalhando offline" indevidamente.

Isso também faz o `useSyncQueue` parar de tentar enviar mídias (ele observa `online`), criando o efeito colateral de uploads "presos" mesmo com rede.

## Correção

### Único arquivo: `src/hooks/useOnlineStatus.ts`

1. Adicionar o header `apikey` (e `Authorization: Bearer <anon>`) no fetch do health-check, lendo `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Usar endpoint mais leve e tolerante: manter `/auth/v1/health` (já é o mais barato), mas tratar **qualquer resposta HTTP** (200/4xx/5xx) como "online" — se o servidor respondeu, há rede. Só consideramos offline quando o `fetch` lança erro de rede ou timeout.
   - Lógica: `try { await fetch(...); setOnline(true) } catch { setOnline(false) }` — mais robusto que `res.ok`, evita falsos negativos por mudança futura no endpoint.
3. Manter o resto: listeners `online`/`offline`, throttle de 30s, fallback `navigator.onLine === false` → offline imediato.

### Não mexer

- `useSyncQueue`, `SyncStatusBanner`, layouts. A correção em um ponto resolve toda a cadeia.

## Validação

1. Após o fix, abrir o app do técnico online → banner some em ≤30s e não reaparece.
2. Desligar Wi-Fi/4G real → banner volta vermelho em ≤30s (ou imediatamente via evento `offline`).
3. Religar → banner some, fila de uploads pendentes processa.

## Resultado

Banner deixa de mentir. Uploads voltam a fluir normalmente quando há rede.

