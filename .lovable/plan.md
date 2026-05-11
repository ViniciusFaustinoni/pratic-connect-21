Faz total sentido. Os logs mostram dois problemas:

1. **Realtime "subindo → fechando → subindo"** — não é "complexidade", é re-subscribe causado por dependência instável: `vendedorId` chega `undefined` na 1ª renderização (enquanto `permissions` carrega) e logo depois muda para o id real. O `useEffect` derruba o canal e abre outro. Em dev, o StrictMode ainda duplica isso. Cada ciclo gasta ~300–800 ms de handshake WebSocket.

2. **Sessão com timeout de 30 min (interno) / 60 min (app)** — você não quer mais. Hoje há `SessionTimeoutProvider` + modal de aviso 5 min antes + auto-logout.

E ainda há um terceiro detalhe: o `CotacaoDetalheModal` chama `useCotacoesRealtime()` sem filtro, abrindo um **segundo canal global** sempre que se abre uma cotação. Soma com o canal da listagem.

## Plano

### 1. Remover expiração de sessão por inatividade
- Desplugar `SessionTimeoutProvider` do `App.tsx` (manter o hook/arquivos por enquanto, só não montar).
- Remover o modal de aviso da árvore.
- Sessão Supabase continua com refresh automático (token nunca expira na prática enquanto a aba viver).

### 2. Estabilizar o canal realtime de cotações
- Não subscrever enquanto `vendedorId` ainda for `undefined` no escopo `own` (gate: `enabled && (viewScope !== 'own' || !!vendedorId)`).
- Tirar o `useCotacoesRealtime()` do `CotacaoDetalheModal` e do `CotacaoDetalhe.tsx` — o canal da listagem já invalida `['cotacoes', id]`. O detalhe só precisa de invalidação pontual via `queryClient.invalidateQueries` no fechamento do modal, ou de um canal **focado em uma única cotação** (`filter: id=eq.${cotacaoId}`) só quando o modal está aberto.
- Manter throttle (3s) — já está bom.

### 3. Reduzir custo do `AuthContext`
- O timeout de 15 s buscando `profiles`+`user_roles` aparece nos logs (`[AuthContext] Timeout (15s) ao buscar profile/perfis`). Vamos:
  - Reduzir o timeout para 5 s (já temos cache `PROFILE_PROMISES`/`PERFIS_PROMISES`; 15 s está mascarando lentidão, não resolvendo).
  - Garantir que o segundo evento (`INITIAL_SESSION` com mesmo user) **não** dispare nova busca. Hoje há `hasLoadedData`, mas é por instância do effect — confirmar.

### 4. (Opcional) Não abrir realtime fora da aba "Em Andamento"
Já está condicionado a `isEmAndamentoTab`. Manter.

## O que NÃO mexemos
- Lógica de busca de cotações, filtros, permissões.
- Toasts de eventos do cliente (visualizou, escolheu plano).
- `useSessionTimeout` continua existindo no código (caso queira reativar para usuários App).

## Resultado esperado
- Cotações abre direto, sem o ciclo "CLOSED → SUBSCRIBED".
- Sem modal de "sessão expirando".
- Um único canal realtime ativo por aba (em vez de 2).