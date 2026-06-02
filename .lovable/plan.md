## Objetivo

Fazer o alerta de transição → `falha_permanente` da Frente 3 efetivamente chegar nos olhos de quem trata o caso. Hoje o alerta é gravado em `notificacoes_sistema` por role, mas o sino (`NotificationBell` → `useMyNotificacoes`) só lê `notificacoes` por `user_id` — ninguém vê. Decisão: fan-out por usuário-alvo, alimentando o sino que já existe, para `coordenador_monitoramento` + `analista_monitoramento`.

## Mudança única

Em `supabase/functions/sga-hinova-sync/index.ts`, dentro de `emitirAlertaCoordenador(...)` (a função introduzida na Frente 3), trocar o INSERT único em `notificacoes_sistema` por:

1. Manter o INSERT em `notificacoes_sistema` (mantém auditoria/canônico e o débito histórico desbloqueia depois).
2. Resolver `auth_user_ids` dos perfis ativos com role em `('coordenador_monitoramento','analista_monitoramento')` via `user_roles` → `profiles.user_id`.
3. Inserir N linhas em `notificacoes` (uma por usuário-alvo), com:
   - `user_id`: cada usuário-alvo
   - `titulo`: "SGA: falha permanente"
   - `mensagem`: `{placa} — {tentativas} tentativas. Ação manual no painel SGA.`
   - `tipo`: `sga_falha_permanente`
   - `categoria`: `tarefa`
   - `prioridade`: `alta`
   - `link`: `/configuracoes/integracoes/sga-hinova?placa={placa}`
   - `referencia_tipo`: `sga_sync_queue` / `referencia_id`: id do item
   - `canal_sistema`: true

## Dedupe

Manter a chave de dedupe 24h por `(placa, motivo)` já usada na função: antes do fan-out, checar se já existe linha em `notificacoes` com `tipo='sga_falha_permanente'` + `referencia_id` do item + criada nas últimas 24h. Se sim, não duplica.

## O que NÃO muda

- Lógica de backoff/tentativas/transição da Frente 3 fica intacta.
- Tabela `notificacoes_sistema` continua sendo populada (não vamos remover agora — o débito de hook por role segue válido para outros produtores: prestador handoff, vistoria, etc.).
- Nenhuma nova tela, nenhuma alteração no `NotificationBell` — ele já consome `notificacoes` por `user_id` via realtime/badge/`/notificacoes`.
- Roles e RLS de `user_roles`/`profiles`/`notificacoes` permanecem como estão (a edge usa `service_role`).

## Resultado esperado e como verificar

- Próxima transição para `falha_permanente`: 10 linhas em `notificacoes` (5 coordenadores + 5 analistas), badge no sino aparece em tempo real, clique abre `/configuracoes/integracoes/sga-hinova?placa=...`.
- Verificar via:
  ```sql
  SELECT user_id, titulo, link, created_at
  FROM notificacoes
  WHERE tipo='sga_falha_permanente'
  ORDER BY created_at DESC LIMIT 20;
  ```
- Acompanhar `supabase--edge_function_logs` de `sga-hinova-sync` no próximo cron pra confirmar `[alerta-fanout] N=10`.

## Fora de escopo (mantido como débito)

- Fan-out genérico para os outros produtores de `notificacoes_sistema` (prestador handoff, vistoria, agente IA). Continua no débito `handoff-notificacoes-sistema-sem-realtime`. Esta entrega resolve só o caso da Frente 3.
- Hook dedicado `useNotificacoesSistemaPorRole` (não escolhido).
- Banner persistente em `/configuracoes/integracoes/sga-hinova` (não escolhido).
