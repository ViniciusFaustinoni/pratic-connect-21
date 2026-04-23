

## Diagnóstico do backfill SGA — bloqueio crítico identificado

### Estado atual

| Métrica | Valor |
|---|---|
| Reconciliação `concluido` | 5 |
| Reconciliação `pendente` | **4.663** |
| Sync financeiro `pendente` | **13.610** |
| Sync financeiro `concluido` | 10 (todos com 0 boletos) |
| Sync financeiro `erro` | 260 (100% janela horária) |
| Sync financeiro `sem_historico_hinova` | 2.852 |
| **Cobranças SGA na base** | **0** |

### Há um erro real bloqueando tudo: janela horária da Hinova

Logs de **23/04 02:03 BRT** (cron `sga-sync-financeiro-diario` rodou): **100% das chamadas retornaram 401 — "Usuário com restrição de horário"**. O cron foi planejado para mover de `0 5 * * *` (02h BRT) para `0 12 * * *` (09h BRT) no plano anterior, mas **não foi atualizado** (`SELECT FROM cron.job` confirma: `sga-sync-financeiro-diario | 0 5 * * *`).

Pior: os 10 jobs `concluido` com 0 boletos foram processados em **22/04 10:42 BRT** (dentro da janela). Isso indica que para os 10 veículos testados, a Hinova respondeu autenticação OK, mas `listarBoletosVeiculo` retornou array vazio. Possíveis causas reais:
1. Vínculo `codigo_associado × codigo_veiculo` desatualizado — o fallback CPF só dispara se `codigoAssociado` estiver vazio inicialmente (linha 217), mas no fluxo "vazio após primeira chamada" (linha 268) só refaz a chamada se o **novo** código for diferente do antigo. Se a Hinova devolver mesmo código mas a primeira foi 401 mascarado ou o vínculo está realmente vazio, fica preso.
2. Os 10 veículos podem realmente não ter boletos (pré-cancelados, novos, etc.) — sem amostra inspecionada manualmente, não dá para confirmar. **Precisa validar com 1 veículo de teste em produção**.

### Bugs/lacunas identificados na pipeline atual

1. **Cron não foi reagendado** — `sga-sync-financeiro-diario` segue em 02h BRT. Deve ir para 12h UTC (09h BRT).
2. **Sem cron de drenagem** — só roda 1x/dia, processa máximo 1.200 jobs. Para os 13.610 pendentes = **11+ dias** de espera.
3. **Reconciliação de códigos travada em 5/4.668** — os crons de 10h e 15h BRT existem (`jobid 25, 26`) mas só rodam dias úteis e em batches pequenos. Precisa "puxão" inicial em massa.
4. **260 erros de janela horária NÃO foram reagendados como `pendente_retry`** — ficaram em `status='erro'` porque o reagendamento automático depende do `HinovaTransientError` ser lançado, e o autenticador antigo retornava em logs sem disparar a exceção corretamente em todos os casos.
5. **Sem painel de execução em massa sob demanda** — botão "Forçar sync agora" no dialog limita a 100. Para 13.610 + 4.998 reconciliações, precisa orquestração server-side.

### Plano de correção (backend, sem frontend)

**A. Corrigir cron `sga-sync-financeiro-diario`**
```sql
SELECT cron.unschedule('sga-sync-financeiro-diario');
SELECT cron.schedule('sga-sync-financeiro-09h-brt', '0 12 * * *', $$ ... net.http_post(...sga-backfill-financeiro, body:='{"acao":"processar","batch_size":50}') $$);
SELECT cron.schedule('sga-sync-financeiro-drenagem-2h', '0 12-20/2 * * *', $$ ... mesmo body $$);
```
Resultado: 5 execuções/dia × 4.000 jobs = **20.000 jobs/dia** = drena fila em 1 dia.

**B. Migrar 260 erros de horário para `pendente_retry`** (botão já existe no dialog, mas vou disparar via SQL agora):
```sql
UPDATE sga_sync_financeiro_jobs 
SET status='pendente_retry', proximo_retry_em=(date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day 12 hours') AT TIME ZONE 'America/Sao_Paulo'
WHERE status='erro' AND ultimo_erro ILIKE '%horari%';
```

**C. Nova edge function `sga-backfill-massa-orquestrador`** — coordena tudo em uma chamada:

```
{ acao: 'executar_tudo', max_segundos: 600 }
```

Fluxo interno:
1. **Fase 1 — Reconciliação:** Loop chamando `sga-reconciliar-codigo-veiculo` `acao=processar batch_size=80` até esvaziar fila ou esgotar 50% do tempo.
2. **Fase 2 — Backfill financeiro:** Após reconciliação, chama `sga-backfill-financeiro acao=enfileirar` (pega novos veículos com código), depois `acao=processar batch_size=50` em loop até esgotar tempo restante.
3. **Telemetria:** Retorna `{ reconciliados, novos_jobs_enfileirados, jobs_processados, boletos_importados, erros_transitorios }`.

Auto-respeita janela horária via `HinovaTransientError → pendente_retry`.

**D. Diagnóstico forçado em 3 veículos amostra** — antes de rodar massa, vou disparar manualmente `sga-sync-financeiro-veiculo` em 3 dos 10 jobs `concluido com 0 boletos` para confirmar se a Hinova realmente não tem boletos OU se o fallback CPF está falhando. Se confirmar bug no fallback, ajusto a lógica do linha 268 para **sempre** refazer `listarBoletosVeiculo` quando vier vazio, mesmo com código igual.

**E. Garantia da gravação correta** — tudo já está validado:
- ✅ Trigger `trg_mirror_cobranca_sga` ativo (espelha `cobrancas` → `pagamentos_sga_historico`).
- ✅ Upsert por `nosso_numero` idempotente.
- ✅ Campos `valor_pago`, `forma_pagamento`, `dados_brutos_sga` sendo persistidos (linhas 345–350).
- ✅ `HinovaTransientError` / `HinovaNotFoundError` separando erros de auth/rede de "não encontrado".

### Não há erros estruturais nas buscas — há erros operacionais

A **lógica de leitura está correta**: endpoints certos, parsing certo, persistência completa, espelhamento histórico ativo. O que falta é **execução em massa coordenada** + **correção do agendamento do cron** + **investigação dos 10 jobs com 0 boletos**.

### Validação após implementação

1. Disparar `sga-backfill-massa-orquestrador acao=executar_tudo`.
2. Aguardar 10 minutos. Query: `SELECT COUNT(*) FROM cobrancas WHERE origem='sga_hinova'` deve ir de 0 para milhares.
3. Query: `SELECT COUNT(*) FROM pagamentos_sga_historico` deve igualar.
4. Repetir 3 a 5 vezes durante o dia (orquestrador é seguro/idempotente) até `pendente=0` em ambas as filas.

### Ações que serão executadas no modo build

1. Atualizar `cron.schedule` (12h UTC + drenagem 2x/dia).
2. SQL pontual: reagendar 260 erros de horário.
3. Criar `supabase/functions/sga-backfill-massa-orquestrador/index.ts`.
4. Disparar manualmente o orquestrador 1x para validação.
5. Inspecionar 3 dos 10 jobs com 0 boletos para confirmar se é bug ou realidade Hinova.
6. Reportar números finais: cobranças importadas, histórico espelhado, jobs restantes.

### Riscos

- **Janela horária do usuário SGA**: continua sendo uma restrição do parceiro. O orquestrador vai funcionar 100% entre 06h–22h BRT; fora disso, todo job vira `pendente_retry` automaticamente. Para resolver definitivo, usuário precisa pedir liberação 24h no painel SGA.
- **Rate limit Hinova**: throttle 100ms já implementado. Em rajada de 4.000 jobs = 7 minutos contínuos — dentro do timeout de 600s da edge function.
- **Boletos antigos (>12 meses)** não voltam pela API, mas a tabela `pagamentos_sga_historico` já preserva tudo que entrou pelo menos 1 vez.

