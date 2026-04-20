

## Diagnóstico — Por que o reagendamento automático não dispara

Analisando `cron-reagendamento-automatico/index.ts` + estado real do banco, achei **3 falhas combinadas**:

### Falha 1 — Filtro de status exclui tarefas em execução
Linha 201: `.eq("status", "agendada")`

Resultado: serviços em `em_rota` ou `em_andamento` (técnico aceitou e saiu para campo, mas não concluiu) **nunca entram no cron**. Evidência no banco agora: serviço `e3b938e6` agendado para 18/04 09h ainda está `em_andamento` 2 dias depois — ignorado pelo cron porque não é `agendada`.

### Falha 2 — Tolerância de 2 horas (você pediu 15 min)
Linhas 228 e 278: `TOLERANCIA_HORA_MIN = "02:00"`. Para hora 09:00, só vira "vencido" às 11:00. Você quer 09:15.

### Falha 3 — Idade mínima de 4h bloqueia reagendamento legítimo
Linha 226: `IDADE_MINIMA_MS = 4h`. Um serviço criado às 08:00 para 09:00, mesmo passando da hora + tolerância, só pode ser reagendado a partir das 12:00 — perdendo a janela toda.

### Falha 4 — Tarefa não é "devolvida" do técnico em todos os caminhos
Quando o cron marca `status = nao_compareceu` no fluxo Parte 2 (linhas 293–299), ele **não** limpa `profissional_id`. A tarefa some do mapa do coordenador mas continua "presa" ao técnico no histórico, e a rota não é liberada para nova atribuição. (No fluxo de órfãos isso já é feito — linha 177 — mas Parte 2 esqueceu.)

### Falha 5 — Frequência do cron
`*/30 * * * *` (a cada 30 min). Com tolerância de 15 min, o cron precisa rodar a cada 5 min para reagir dentro da janela esperada.

---

## Plano de correção

### 1) `supabase/functions/cron-reagendamento-automatico/index.ts`

**Parte 2 — reescrever a query e a lógica:**

- Trocar `.eq("status", "agendada")` por `.in("status", ["agendada", "em_rota", "em_andamento"])` para apanhar tarefas que o técnico aceitou mas não concluiu.
- Reduzir `TOLERANCIA_HORA_MIN` de `"02:00"` para `"00:15"`.
- Reduzir `IDADE_MINIMA_MS` de 4h para 30 min (suficiente para evitar reagendar agendamentos criados acidentalmente; não bloqueia janelas curtas).
- Para `periodo` sem hora específica, manter cutoff por período mas **encurtar tolerância**:
  - `manha`: cutoff `12:15` (era 14:00)
  - `tarde`: cutoff `17:15` (era 19:00)
  - `noite`: cutoff `21:15` (era 23:00)
- Ao marcar `status = nao_compareceu`, **também limpar**:
  ```ts
  profissional_id: null,
  hora_agendada_original: <hora atual>, // preserva auditoria, opcional
  updated_at: now
  ```
  e cancelar entradas em `fila_servicos` ligadas ao serviço (`UPDATE fila_servicos SET status='cancelado' WHERE servico_id = ?`).
- Logar explicitamente "tarefa devolvida do técnico X" para rastreabilidade.

**Trecho-chave:**
```ts
const TOLERANCIA_HORA_MIN = "00:15";
const IDADE_MINIMA_MS = 30 * 60 * 1000;
const cutoffPeriodo = { manha: "12:15", tarde: "17:15", noite: "21:15" };

// query expandida
.in("status", ["agendada", "em_rota", "em_andamento"])

// update expandido
.update({
  status: "nao_compareceu",
  profissional_id: null,
  updated_at: new Date().toISOString(),
})
// + limpar fila_servicos do serviço
await supabase.from("fila_servicos")
  .update({ status: "cancelado" })
  .eq("servico_id", servico.id)
  .eq("status", "aguardando");
```

### 2) Aumentar frequência do cron
Migration que troca o schedule de `cron-reagendamento-automatico-30min` para `*/5 * * * *` (a cada 5 min) e renomeia para `cron-reagendamento-automatico-5min`. Isso garante reação dentro de 5 min após a tolerância vencer.

### 3) Garantir envio do link mesmo em `em_andamento`
A função `enviar-link-reagendamento` já é idempotente (guard `reagendamento_enviado_em`). Sem mudança necessária.

### 4) Realtime para o app do técnico
O hook `useServicosRealtime.ts` já escuta `UPDATE` em `servicos` filtrado por `profissional_id`. Quando o cron setar `profissional_id = null`, o app do técnico receberá um evento e a tarefa **sai automaticamente** da tela dele (a query `tarefa-atual` será reinvalidada e voltará vazia). Sem mudança necessária.

### 5) Reatribuição automática
O `cron-atribuir-tarefas` (`*/5 * * * *`) já varre serviços `agendada` sem `profissional_id` e atribui ao técnico mais próximo. Com `nao_compareceu` setado, fluxo de **reagendamento manual pelo associado** (`reagendar-vistoria-publica`) recolocará em `agendada` e o cron de atribuição assume o resto. Sem mudança necessária.

---

## Comportamento final esperado

```text
09:00 ─ hora_agendada
   │
   │ técnico não conclui (continua em em_rota / em_andamento / agendada)
   │
09:15 ─ tolerância vence
   │
≤09:20 ─ cron-reagendamento-automatico (5 min) executa:
        ├─ status     → nao_compareceu
        ├─ profissional_id → null         (sai da tela do técnico via Realtime)
        ├─ fila_servicos do serviço → cancelado
        └─ invoke enviar-link-reagendamento
                  └─ WhatsApp com link /reagendar/<token> ao associado

associado escolhe nova data/hora no link público
   │
reagendar-vistoria-publica → status = agendada, nova data/hora
   │
cron-atribuir-tarefas (5 min) → atribui ao técnico mais próximo
```

## Validação após deploy

1. Criar serviço de teste para hoje, hora `now()-20min`, status `em_andamento`, com `profissional_id` preenchido.
2. Rodar `cron-reagendamento-automatico` manualmente (ou aguardar 5 min).
3. Conferir no banco: `status='nao_compareceu'`, `profissional_id IS NULL`, `reagendamento_enviado_em` preenchido.
4. App do técnico: tarefa some imediatamente (Realtime).
5. WhatsApp do associado: link recebido.
6. Abrir link, escolher nova data → serviço volta para `agendada` → cron de atribuição reatribui.

## Arquivos tocados
- `supabase/functions/cron-reagendamento-automatico/index.ts` (lógica + tolerância + limpar profissional_id + fila)
- Migração SQL para reagendar o cron job de `*/30` para `*/5`

Sem mudança de schema. Sem nova dependência. Sem mudança de frontend.

