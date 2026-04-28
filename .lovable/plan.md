## Plano Faseado — Correção Definitiva dos 38 Erros do Fluxo de Ativação

Estruturado em **6 fases sequenciais**, começando pelos 5 riscos críticos. Cada fase é independente e deployável isoladamente, permitindo validação incremental sem travar o fluxo de produção.

---

### FASE 0 — Infraestrutura de Segurança (pré-requisito, 1 dia)

Antes de tocar em qualquer lógica de negócio, criar os mecanismos que as próximas fases vão consumir:

1. **Advisory locks helper** — função SQL `pg_try_advisory_xact_lock(hashtext('ativacao:' || associado_id))` encapsulada em `public.fn_lock_ativacao(uuid)` retornando boolean.
2. **Tabela de auditoria de transições** — `ativacao_status_log` (associado_id, contrato_id, from_status, to_status, source, actor_id, payload jsonb, created_at) — alimentada por trigger único em `associados`.
3. **Helper de validação de campos obrigatórios** — função SQL `fn_validar_campos_ativacao(associado_id)` retornando jsonb com array de campos faltantes (cpf, chassi, renavam, placa, telefone).
4. **Tabela de fila genérica de retry** — `integration_retry_queue` (id, integration ENUM[sga,softruck,rede], operation, payload, attempts, last_error, next_attempt_at, status) — para unificar com a `sga_sync_queue` existente em fase futura.

**Saída:** PR único, sem mudança de comportamento — apenas infraestrutura.

---

### FASE 1 — Race Conditions e Duplicação de Ativação (CRÍTICO #1)

**Erros cobertos:** 1, 2, 3 (duplicate entry points para `status='ativo'`).

1. Em `useAprovacaoMonitoramento.ts` e `useVistoriaCompletaAnalise.ts`, ambos chamam uma nova edge function única **`ativar-associado`** que:
   - Adquire advisory lock via `fn_lock_ativacao`.
   - Lê estado atual (`SELECT ... FOR UPDATE`).
   - Valida pré-condições (contrato assinado, instalação aprovada, vistoria aprovada).
   - Aplica transição idempotente (se já `ativo`, retorna sucesso sem reexecutar side effects).
   - Loga em `ativacao_status_log`.
2. Em `aprovar-proposta/index.ts`, substituir o bulk update por `UPDATE ... WHERE status = $expected_status` (compare-and-swap), retornando erro 409 se webhook concorrente já mudou o estado.
3. Remover qualquer outro caminho que escreva `status='ativo'` direto na tabela — bloquear via trigger `BEFORE UPDATE` que rejeita transições não originadas pela edge function (checa `current_setting('app.ativacao_source', true)`).

---

### FASE 2 — Sincronizações SGA/Softruck/Rede com Garantia de Entrega (CRÍTICOS #2, #4)

**Erros cobertos:** sync fire-and-forget, vazamentos em reprovação, falhas silenciosas em webhooks de pagamento.

1. **Eliminar fire-and-forget**: substituir todas as chamadas `fetch().catch()` em `aprovar-proposta`, `useAtivacoes.ts`, `asaas-webhook` e `cron-suspender-inadimplentes` por enfileiramento síncrono em `integration_retry_queue` com status `pending`.
2. **Worker único `process-integration-queue`** (cron a cada 1 min) que:
   - Pega lote de até 50 itens `pending` ou `failed` com `next_attempt_at <= now()`.
   - Executa com `AbortSignal.timeout(15000)`.
   - Backoff exponencial (1min, 5min, 30min, 2h, 6h) até 5 tentativas; depois marca `dead_letter` e dispara alerta no `relatos_erros`.
3. **Reprovação de instalação** (`useReprovarInstalacaoMonitoramento`): além de reverter status do associado, enfileirar:
   - `softruck:desativar_dispositivo`
   - `rede:desvincular_cliente`
   - `sga:cancelar_associado` (se já sincronizado)
   - Update em `contratos.status = 'cancelado_reprovacao'` para parar cobrança recorrente.

---

### FASE 3 — Validação de Pré-Requisitos e Bloqueio de Estados Inválidos (CRÍTICO #5)

**Erros cobertos:** campos obrigatórios não validados, cancelamento durante execução em campo, instalação pós-cancelamento.

1. Edge function `ativar-associado` (Fase 1) chama `fn_validar_campos_ativacao` antes de prosseguir; se retornar campos faltantes, retorna 422 com lista — UI exibe modal bloqueante.
2. Mesma validação aplicada na **aprovação do monitor** e na **finalização da instalação em campo** (não só no momento de virar `ativo`).
3. **Trigger `trg_bloquear_instalacao_se_cancelado`** em `instalacoes` BEFORE UPDATE: rejeita `status='concluida'` se o associado estiver em `cancelado`, `cancelamento_solicitado` ou `inadimplente_terminal`.
4. Trigger espelhado em `vistorias` e `servicos` para mesma proteção cruzada.

---

### FASE 4 — Estados Limbo e Cleanup Automático

**Erros cobertos:** associados presos em `aguardando_instalacao`/`assinado`, `aprovado_em` órfão, transições falhadas sem retry.

1. **Cron `cron-detectar-limbo-ativacao`** (a cada 30 min):
   - Identifica associados em `aguardando_instalacao` há > 72h sem agendamento ativo → cria tarefa em `relatos_erros` com severidade média.
   - Identifica `assinado` com `aprovado_em` preenchido e contrato Autentique completo há > 1h → reenfileira `ativar-associado`.
   - Identifica instalações `em_andamento` há > 24h → notifica coordenador de monitoramento.
2. **Dashboard `/diretoria/saude-ativacao`** consumindo `ativacao_status_log` + `integration_retry_queue` mostrando: funil em tempo real, itens travados, taxa de sucesso por integração, dead letters.

---

### FASE 5 — Triggers Silenciosos e Permissões RLS

**Erros cobertos:** `RAISE NOTICE` mascarando erros financeiros, RLS faltante para `prestador`/`instalador`.

1. Refatorar `fn_estorno_cancelamento` e `trigger_calcular_comissao`:
   - Substituir `RAISE NOTICE` por `RAISE EXCEPTION` quando a falha for em dado financeiro (estorno, comissão).
   - Manter `NOTICE` apenas para casos verdadeiramente opcionais, e nesses casos gravar em `relatos_erros` automaticamente.
2. Adicionar políticas RLS para `prestador` e `instalador` em: `instalacoes`, `vistorias`, `servicos`, `agendamentos_base`, `associados` (somente registros vinculados ao próprio user_id).
3. Edge function wrapper que, ao receber PostgrestError com código `42501` (insufficient_privilege), retorna mensagem amigável "Sem permissão para esta operação — contate o coordenador" em vez de erro genérico.

---

### Ordem de Deploy e Critério de Aceite

```text
Fase 0  → infra        → sem efeito visível
Fase 1  → ativacao     → testar dupla aprovação simultânea (2 abas)
Fase 2  → integrações  → testar reprovação + verificar Softruck/Rede desativados
Fase 3  → validações   → tentar ativar com chassi vazio (deve bloquear)
Fase 4  → limbo        → simular associado preso 72h
Fase 5  → triggers/RLS → executar suite Deno tests
```

Cada fase entra atrás de feature flag (`ativacao_v2_*`) na tabela `feature_flags`, permitindo rollback instantâneo sem redeploy.

---

### Detalhes Técnicos

**Arquivos novos:**
- `supabase/functions/ativar-associado/index.ts`
- `supabase/functions/process-integration-queue/index.ts`
- `supabase/functions/cron-detectar-limbo-ativacao/index.ts`
- `src/pages/diretoria/SaudeAtivacao.tsx`
- `src/hooks/useSaudeAtivacao.ts`

**Arquivos modificados (principais):**
- `src/hooks/useAprovacaoMonitoramento.ts`
- `src/hooks/useVistoriaCompletaAnalise.ts`
- `src/hooks/useReprovarInstalacaoMonitoramento.ts`
- `src/hooks/useAtivacoes.ts`
- `supabase/functions/aprovar-proposta/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/cron-suspender-inadimplentes/index.ts`

**Migrations:** 6 (1 por fase, isoladas).

**Tempo estimado:** 8–10 dias úteis (Fase 0–1 em paralelo possível; restante sequencial).

---

**Aprovar para começar pela Fase 0 + Fase 1 (críticos #1, #2, #5)?** Posso entregar essas duas fases no primeiro deploy e seguir para Fase 2 após validação em homologação.
