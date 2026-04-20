

## Corrigir cancelamentos automáticos indevidos da vistoria

### Diagnóstico (confirmado nos logs de hoje)
O cron `cron-reagendamento-automatico` marcou 7 serviços como `nao_compareceu` e disparou link de reagendamento. Causas:

1. **Não filtra por `local_vistoria`** — serviços agendados na **base** entram no loop de "não compareceu", mesmo o associado estando lá fisicamente.
2. **Cutoff por período ignora `created_at`** — serviços criados às 18:51/19:13/20:38 com `periodo='manha'` são cancelados imediatamente porque o cutoff `12:15` já passou. A guarda de "30min de idade" só atrasa, não impede.
3. **Sem revalidação de status antes do envio** — entre o SELECT do cron e o envio do WhatsApp pode haver corrida (profissional acabou de fechar a OS).

### Escopo aprovado
**Não alterar o template Meta** (`reagendamento_servico`) nem o texto de fallback Evolution. Apenas corrigir a lógica do cron para parar de cancelar indevidamente.

### O que será feito

#### 1. `cron-reagendamento-automatico/index.ts` — filtro por local
- Adicionar `local_vistoria` ao SELECT de `servicos`.
- Na Parte 2 (regra de "não compareceu"), **pular** todos os serviços com `local_vistoria = 'base'`. Atendimento na base não tem cancelamento automático — quem fecha é o atendente.

#### 2. `cron-reagendamento-automatico/index.ts` — cutoff coerente com criação
Para serviços **sem `hora_agendada`** (cutoff por período):
- Se `created_at` for **posterior** ao cutoff do dia atual, **não cancelar** nesta execução.
- Aguardar o próximo período/dia para reavaliar.
- Mantém intacta a lógica para serviços com `hora_agendada` (cancelamento por horário absoluto continua igual).

#### 3. `cron-reagendamento-automatico/index.ts` — guard anti-corrida
Antes de invocar `enviar-link-reagendamento`, fazer um `SELECT status` rápido do serviço. Se o status já não for mais `agendada/em_rota/em_andamento` (ex.: `concluida`), abortar o envio para esse item.

### Arquivos editados
- `supabase/functions/cron-reagendamento-automatico/index.ts` (única alteração)

### Validação
1. Serviço com `local_vistoria='base'` → cron ignora, sem mensagem.
2. Serviço a domicílio criado às 19:00 com `periodo='manha'` → cron NÃO cancela hoje.
3. Serviço a domicílio com `hora_agendada=10:00` não iniciado às 10:30 → cron continua cancelando (comportamento correto preservado).
4. Serviço concluído entre o SELECT e o envio → não recebe mensagem de reagendamento.
5. Texto recebido pelo associado permanece exatamente igual ao atual (template Meta inalterado).

