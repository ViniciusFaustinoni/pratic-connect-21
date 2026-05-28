
## Diagnóstico — LTC8G02 (IMEI 359366080311592)

**Estado atual em `rastreadores`:**
- `softruck_integration_status = PENDING`
- `softruck_tentativas = 0`
- `softruck_response_raw = NULL`
- `softruck_last_attempt_at = 2026-05-28 18:54:56` (hoje)
- `plataforma_device_id = 359366080311592` ⚠️ **é o próprio IMEI, não um ID real Softruck** (formato real seria tipo `qekgzQoqPJwdAr8`)
- `plataforma_veiculo_id = PR97L1qVkzLnlrm` (formato real Softruck — vehicle foi criado)
- `id_plataforma = 359366080311592` ⚠️ idem
- Payload registrado: `{imei, veiculoId, associadoId, associadoEmail}`

**Logs de `softruck-ativar-dispositivo`**: zerados para este IMEI/placa. A função iniciou (gravou PENDING) mas nunca completou o passo 8.5 (UPDATE final canônico com `SUCCESS`).

**O que aconteceu**: o fluxo de ativação criou o veículo na Softruck (vehicle_id real), populou `plataforma_device_id` com o IMEI como placeholder otimista vindo de outro caminho (`popular-ids-softruck` ou hook anterior), e morreu antes de chamar `criar-device` / `ativar-device`. A guarda do `softruck-ativar-dispositivo` (linhas 185–200) considera "já totalmente ativado" quando ambos IDs estão preenchidos — então uma nova invocação retorna `already_activated:true` sem fazer nada, ainda que o device IMEI nunca tenha sido criado na Softruck.

## Problema sistêmico (não é caso isolado)

Query confirma: **45 rastreadores Softruck instalados estão presos em `PENDING`** indefinidamente, alguns desde 20/04/2026. Causas:

1. **Não existe cron** invocando `softruck-reconciliar-pending` nem `softruck-backfill-veiculos` (consulta em `cron.job` retornou vazio). Eles só rodam se alguém clicar manualmente em "Backfill" na tela de Integrações.
2. **`softruck-backfill-veiculos`** (e o card de UI em `useRastreadoresSyncStatus`) só conta o problema, mas o backfill efetivo processa um lote pequeno (50) e ignora rastreadores cujo `plataforma_device_id` já está preenchido (mesmo quando é o IMEI placeholder).
3. **Guarda do `ativar-dispositivo` (linhas 185–200)** trata "IDs preenchidos" como sinônimo de "concluído", ignorando `softruck_integration_status`. Quando IMEI vira device_id por engano, nunca mais reativa.
4. **`softruck_tentativas` nunca é incrementado** em nenhum lugar — então não há sinal de "isto está falhando há X tentativas".

Por isso o LTC8G02 **"nem aparece na fila de reprocessamento"**: a fila não existe como conceito ativo.

## Plano de correção

### 1. Reprocessar o LTC8G02 agora (sob aprovação)

Migration para limpar o estado inconsistente do rastreador `9ac6603f-1a16-4596-801b-fe4661379232`:
- Zerar `plataforma_device_id`, `id_plataforma`, `softruck_response_raw` (mantendo `plataforma_veiculo_id` se a placa bater com o remoto — vamos validar via `softruck-reconciliar-pending` em `dry_run`).
- Setar `softruck_integration_status = NULL` para permitir nova ativação.

Depois invocar `softruck-ativar-dispositivo` com o payload original. Logar resultado e confirmar `SUCCESS` + `plataforma_device_id` no formato real Softruck.

### 2. Fechar a guarda do `ativar-dispositivo`

Em `supabase/functions/softruck-ativar-dispositivo/index.ts`, linha 185, mudar critério de "já ativado" para exigir também `softruck_integration_status === 'SUCCESS'` **e** que `plataforma_device_id` não seja igual ao IMEI (regex `/^\d{14,16}$/` + bate com IMEI → placeholder, ignorar). Assim placeholders nunca mais bloqueiam reativação.

### 3. Incrementar `softruck_tentativas`

Em `updateIntegrationStatus`, sempre que `status !== 'SUCCESS'` fazer `softruck_tentativas = softruck_tentativas + 1` (via RPC ou select+update). Limite duro: 5 tentativas, depois marca `FAILED_*` definitivo e exige intervenção manual.

### 4. Criar `cron-softruck-reconciliar-pending`

Nova edge function que, a cada 10 min:
- Seleciona rastreadores `plataforma='softruck'`, `status='instalado'`, `softruck_integration_status='PENDING'`, `softruck_last_attempt_at < now() - 5 min`, `softruck_tentativas < 5` (lote 20).
- Para cada um:
  - Se `plataforma_device_id` parece IMEI (placeholder), zera e chama `softruck-ativar-dispositivo`.
  - Caso contrário, chama `softruck-reconciliar-pending` (caminho canônico já existente para fechar o UPDATE final).
- Registra resultado em `rastreadores_api_logs`.

Agendar via `pg_cron`:
```sql
select cron.schedule(
  'softruck-reconciliar-pending-10min',
  '*/10 * * * *',
  $$ select net.http_post(...softruck-reconciliar-pending-cron...) $$
);
```

### 5. UI — botão "Reprocessar agora" no drawer do rastreador

Adicionar em `src/components/rastreadores/...` (drawer/detalhe) um botão visível quando `softruck_integration_status` ∈ {`PENDING`, `FAILED_*`} que invoca a mesma rotina de reset + reativação. Isso elimina a dependência de operador SQL para esses casos.

### 6. Atualizar memória do projeto

Criar `mem://logic/integrations/softruck-pending-reconciliation-canonica` com o caminho canônico de reprocessamento (cron + drawer + reset de placeholder) para não voltarmos a perder PENDING.

## Detalhes técnicos

**Arquivos a editar:**
- `supabase/functions/softruck-ativar-dispositivo/index.ts` (guarda + tentativas)
- novo `supabase/functions/cron-softruck-reconciliar-pending/index.ts`
- novo `supabase/migrations/...sql` (hotfix LTC8G02 + schedule `pg_cron`)
- `src/components/rastreadores/...Drawer.tsx` (botão "Reprocessar")
- `src/hooks/useRastreadoresSyncStatus.ts` (expor ação de reprocessamento individual, opcional)
- `mem://logic/integrations/softruck-pending-reconciliation-canonica`
- update `mem://index.md` core

**Validações pós-deploy:**
- LTC8G02 com `softruck_integration_status='SUCCESS'` e `plataforma_device_id` ≠ IMEI.
- Query agregada: PENDING deve cair de 45 para próximo de 0 em algumas horas.
- Edge function logs do novo cron sem erros recorrentes.
