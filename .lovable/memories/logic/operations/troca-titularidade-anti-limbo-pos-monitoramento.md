---
name: Troca de Titularidade — anti-limbo pós-Monitoramento
description: Solicitação em aguardando_vistoria/aguardando_manutencao SEM serviço de campo vivo é proibida em 3 camadas (edge atômica, trigger DB, cron + UI). Caso original LQY5543 / LUJ0G95 (junho/26).
type: feature
---

# Princípio canônico

**Status `aguardando_vistoria` / `aguardando_manutencao` em `solicitacoes_troca_titularidade` exige `servico_vistoria_id` / `servico_manutencao_id` apontando para um `servicos` vivo (não cancelado).** Sem isso a fila do Monitoramento não enxerga a solicitação — é limbo invisível.

Origem: 09/06/26 — solicitações LQY5543 (`50e43757…`) e LUJ0G95 (`aaf27c03…`) ficaram em `aguardando_vistoria` por ~29 h e ~4 dias respectivamente. A branch antiga de `solicitar_vistoria` em `supabase/functions/aprovar-troca-monitoramento/index.ts` apenas mudava o status + WhatsApp, sem materializar o `servicos`. Backfill manual resolveu pontualmente.

# Defesa em profundidade

## 1) Atomicidade na edge (já existente)

`aprovar-troca-monitoramento/index.ts` faz `INSERT servicos` → `UPDATE solicitacoes_troca_titularidade`. Em caso de falha no UPDATE, deleta o serviço criado (rollback manual). Regressão futura é bloqueada pela camada 2.

## 2) Guard no banco — `trg_guard_troca_status_exige_servico`

`fn_guard_troca_status_exige_servico` (BEFORE INSERT OR UPDATE OF status/servico_vistoria_id/servico_manutencao_id em `solicitacoes_troca_titularidade`):

- Quando `NEW.status='aguardando_vistoria'` E (insert OR status mudou OR servico_vistoria_id mudou): exige `NEW.servico_vistoria_id` NOT NULL apontando para `servicos` existente e `status<>'cancelada'`. Senão `RAISE EXCEPTION` (check_violation).
- Idem para `aguardando_manutencao` com `servico_manutencao_id`.
- Mensagem de erro inclui HINT apontando para a edge canônica.

Bloqueia atalho por qualquer caminho (edge, script SQL, painel).

## 3) Detector + cron — `fn_detectar_troca_limbo` / `fn_reconciliar_troca_titularidade_limbo`

- `fn_detectar_troca_limbo(p_min_idade_minutos integer)` retorna solicitações em `aguardando_*` cujo `servico_*_id` está NULL OU aponta para serviço inexistente OU cancelado.
- `fn_reconciliar_troca_titularidade_limbo()` chamada pelo cron `reconciliar-troca-titularidade-limbo` (15 min): varre com `p_min_idade_minutos=15`, insere `notificacoes_sistema` (`tipo='troca_limbo_pos_monitoramento'`, `destino_role='monitoramento'`, dedup 1h via lookup em `created_at`), grava log com prefixo `[reconcilia_troca_limbo]` em `logs_auditoria`.
- Não tenta re-materializar automaticamente — endereço da vistoria vem no payload da edge e não está persistido na solicitação. Recuperação = operador reabre "Solicitar Vistoria/Retirada/Manutenção" no `ModalDetalhesTroca`.

## 4) Visibilidade na UI

- `useTrocaLimbo(minIdade)` / `useSolicitacaoEmLimbo(id)` consomem `fn_detectar_troca_limbo` (refetch 60s).
- `ModalDetalhesTroca` (aba Timeline) mostra `<Alert variant="destructive">` "Serviço de campo não materializado" quando a solicitação aberta está em limbo.
- `/monitoramento/aprovacoes-troca` exibe chip vermelho "Em limbo: N" no header + badge "Sem serviço materializado" no card de cada solicitação afetada.

# Anti-padrões proibidos

- `UPDATE solicitacoes_troca_titularidade SET status='aguardando_vistoria'` sem INSERT atômico de `servicos` → trigger rejeita (check_violation).
- Cancelar `servicos` da troca sem rebobinar `solicitacoes_troca_titularidade.status` para `aguardando_monitoramento` → entra em limbo, cron detecta e notifica.
- Nova branch de monitoramento que mude status sem materializar serviço → mesmo bloqueio do guard.

# Casos de referência

- LQY5543 (`50e43757-813f-4a45-b7b6-f7803066b641`) — 08/06 17:44 → 09/06 22:49 (backfill).
- LUJ0G95 (`aaf27c03-91e4-44d2-8fb3-52d4cbb9d75e`) — 05/06 → 09/06 22:51 (backfill).
