

## Plano: Remover notificação duplicada da atribuição

### Problema
A `cron-atribuir-tarefas` envia `tecnico_em_rota` ao associado no momento da atribuição, antes do técnico iniciar. A `notificar-inicio-rota` envia a mesma notificação quando o técnico clica "Iniciar Tarefa". Resultado: mensagem prematura + possível duplicata.

### Solução
Remover o bloco de notificação `tecnico_em_rota` da `cron-atribuir-tarefas` (linhas 463-486), mantendo-a **exclusivamente** na `notificar-inicio-rota` (acionada pelo botão "Iniciar Tarefa").

### Alteração

**Arquivo**: `supabase/functions/cron-atribuir-tarefas/index.ts`
- Remover linhas 463-486 (bloco que envia `tecnico_em_rota` via `notificar-cliente`)
- Manter o push notification ao instalador (linha 489+) — esse é correto, avisa o técnico que recebeu uma tarefa

**Arquivo**: `supabase/functions/notificar-inicio-rota/index.ts`
- Remover a lógica `jaNotificadoPeloCron` (linhas 118-134) — não é mais necessária, pois só existe um ponto de envio
- Simplificar: sempre enviar a notificação quando o instalador clica "Iniciar Tarefa"

### Fluxo final limpo
```text
Atribuição (cron) → status 'agendada' + push ao instalador
    ↓
Instalador clica "Iniciar Tarefa" → status 'em_rota'
    └─ notificar-inicio-rota → WhatsApp 'tecnico_a_caminho_1' ao associado (ÚNICO ponto)
```

### Deploy
Redeployar ambas as Edge Functions após as alterações.

