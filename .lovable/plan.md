## Diagnóstico — por que está lento (~4,2 jobs/min)

Cada job de veículo hoje executa **sequencialmente** dentro de si:

1. `getHinovaSession({ noCache: true })` → **1 login fresh** (~500–1500 ms na Hinova).
2. `buscarVeiculoPorPlaca` → 1 chamada.
3. `buscarAssociadoPorCpf` (quando faltam códigos) → 1 chamada.
4. `buscarSituacaoFinanceiraVeiculo` → 1 chamada.
5. `listarBoletosVeiculo` → **~12 chamadas sequenciais** (3 anos / 90 dias = 12 janelas).
6. Possível fallback CPF → +1 login + +12 janelas.
7. Upserts em `cobrancas` um a um (sem batch).

Resultado: **15–25 chamadas HTTP serializadas por veículo**, cada job consumindo 8–15 s. Com `concurrency: 8` no batch (e `BATCH=20` na drenagem em background), o teto efetivo bate exatamente nos ~4 jobs/min observados.

Estado atual da fila: 5.371 pendentes + 3.283 pendente_retry + 1.096 erros = ~9.750 a drenar.

## Plano de otimização

### 1. Reuso de sessão Hinova dentro do batch (maior ganho)

Hoje cada job autentica do zero por causa do `noCache: true` (proteção contra invalidação cruzada). Vamos manter isolamento entre invocações, mas **compartilhar uma única sessão dentro de cada batch de `sga-backfill-financeiro`**:

- Em `sga-backfill-financeiro` (acao=processar): autenticar **uma vez** no início e passar `session` para os jobs via novo parâmetro de `sga-sync-financeiro-veiculo` (`hinova_session?: { tokenUsuario, apiUrl }`).
- Em `sga-sync-financeiro-veiculo`: se receber `hinova_session`, usar direto; só autenticar fresh em fallback (401 inline já tratado pelo `withReauthRetry`).
- Economiza **1–2 logins por job** → ~30–50% de tempo a menos por veículo.

### 2. Paralelizar as 12 janelas de boletos

Em `_shared/hinova-client.ts → listarBoletosVeiculo`, hoje é loop sequencial. Trocar por `Promise.allSettled` em chunks de 4 janelas paralelas:

- 12 janelas × 600 ms sequencial ≈ 7,2 s → 3 chunks × 600 ms paralelo ≈ 1,8 s.
- Mantém deduplicação por `nosso_numero` e tratamento de erros transitórios (auth/rate_limit/janela_horaria continuam abortando tudo).
- Adicionar opção `paralelismoJanelas: number` (default 4) para tunar.

### 3. Elevar concorrência e batch da drenagem

Em `cron-sga-sync-financeiro-drenagem-5min` e em `sga-backfill-massa-orquestrador`:

- `BATCH`: 20 → **40** (limite da Hinova suporta com folga após dedup de auth).
- `concurrency` enviado a `sga-backfill-financeiro`: 8 → **12**.
- `delay_ms` entre chunks: 100 → **50** (com circuit breaker já existente para auth/rate, é seguro).

### 4. Upsert em batch de cobrancas

Em `sga-sync-financeiro-veiculo`, trocar o loop `for (const b of boletos) { upsert(...) }` por **um único `upsert(rows, { onConflict: 'nosso_numero' })`** com todas as linhas do veículo. Para 12 boletos médios isso elimina 11 RTTs ao Postgres.

### 5. Pular reconciliação quando códigos já existem (fast-path)

Hoje `buscarVeiculoPorPlaca` é sempre chamado se há `placa`, mesmo quando `veiculo.codigo_hinova` e `associado.codigo_hinova` já estão preenchidos e válidos. Mudar para:

- Se ambos códigos já existem → pular reconciliação por placa/CPF e ir direto para `listarBoletosVeiculo`.
- Só cair no fallback de placa/CPF quando `boletos.length === 0` (já existe lógica parecida).
- Veículos já reconciliados (a maioria após a primeira passada) economizam 1–2 chamadas Hinova.

### 6. Heartbeat menos chatto (micro-otimização)

Atualizar `sga_runtime_state` a cada chunk de concurrency soma latência. Mudar para a cada **3 chunks** ou a cada 5 s (o que vier antes), mantendo TTL de 2 min do cron.

## Impacto esperado

| Métrica | Antes | Depois (estimado) |
|---|---|---|
| HTTP/veículo | 15–25 | 4–8 |
| Tempo/veículo | 8–15 s | 2–4 s |
| Jobs/min | ~4,2 | **~25–40** |
| ETA fila atual (~9,7k) | ~34h | **~6–8h** |

## Arquivos a alterar

- `supabase/functions/_shared/hinova-client.ts` → paralelizar `listarBoletosVeiculo` (chunks).
- `supabase/functions/sga-sync-financeiro-veiculo/index.ts` → aceitar `hinova_session` no body, fast-path de reconciliação, upsert em batch.
- `supabase/functions/sga-backfill-financeiro/index.ts` → autenticar 1× por batch e propagar `hinova_session`; aumentar caps default; concurrency 12.
- `supabase/functions/cron-sga-sync-financeiro-diario/index.ts` (drenagem 5min) → BATCH=40, concurrency=12, heartbeat menos frequente.
- `supabase/functions/sga-backfill-massa-orquestrador/index.ts` → ajustar defaults `batch_financeiro=80`.

## Salvaguardas mantidas

- Circuit breaker de 5 falhas auth consecutivas continua ativo.
- `withReauthRetry` em 401 inline continua reautenticando uma vez.
- Pause via `backfill_cancelar_solicitado` continua respeitada.
- Idempotência por `nosso_numero` preservada (upsert em batch usa o mesmo conflito).
- Janela horária da Hinova: jobs com `auth/horario` continuam virando `pendente_retry` para a próxima janela 09h BRT.

## Não incluso (fora de escopo / requer ação manual)

- Liberar mais permissões da API Hinova (já solicitado em conversa anterior).
- Substituir `/listar/boleto-associado-veiculo` por endpoint de listagem em massa — Hinova não expõe oficialmente.
