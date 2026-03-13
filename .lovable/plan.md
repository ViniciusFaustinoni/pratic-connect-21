
Objetivo: destravar a resposta da IA via Meta com abordagem **completa** (configuração + blindagem de código), mantendo o fluxo atual sem regressão na Evolution.

Diagnóstico confirmado (produção):
- `whatsapp_mensagens` tem **0 entradas nas últimas 24h** (`direcao='entrada'`).
- Não há logs de POST reais em `whatsapp-meta-webhook` (apenas testes manuais).
- Portanto, o gargalo atual está **antes da IA**: o evento de mensagem da Meta não está chegando/processando de forma confiável.

Plano de implementação

1) Blindagem de compatibilidade entre endpoints
- Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
- Adicionar detecção de payload nativo da Meta (`object=whatsapp_business_account` + `entry[]`).
- Se detectar, encaminhar internamente para `whatsapp-meta-webhook` e retornar `200`.
- Resultado: mesmo com callback apontando para endpoint “errado”, o sistema continua funcionando.

2) Robustez do parser Meta + idempotência prática
- Arquivo: `supabase/functions/whatsapp-meta-webhook/index.ts`
- Processar `changes` mesmo quando `field` vier ausente/variante, usando presença de `value.messages`/`value.statuses`.
- Manter normalização de `tipo/status` já corrigida.
- Melhorar logs estruturados por mensagem (message_id, from, tipo, etapa de delegação, erro detalhado).
- Garantir que falhas de delegação não “sumam” (log explícito e continuidade controlada).

3) Telemetria operacional visível no painel
- Migração SQL: adicionar em `whatsapp_meta_config`:
  - `last_webhook_at timestamptz`
  - `last_webhook_event text`
  - `last_webhook_messages_count int`
  - `last_webhook_statuses_count int`
  - `last_webhook_error text`
- Atualizar esses campos a cada POST no `whatsapp-meta-webhook`.

4) Feedback no front para diagnóstico rápido
- Arquivos: `src/hooks/useWhatsAppMeta.ts`, `src/components/integracoes/WhatsAppProvedorSelector.tsx`
- Exibir “Último webhook recebido”, contagem de messages/statuses e último erro.
- Mostrar alerta claro quando não houver webhook recente (ex.: >24h), evitando “IA muda” sem diagnóstico.

5) Validação ponta a ponta (obrigatória)
- Testar webhook Meta (evento de teste + mensagem real “Bati de Carro”).
- Confirmar sequência:
  1. log no `whatsapp-meta-webhook`
  2. registro `entrada` em `whatsapp_mensagens`
  3. delegação para `whatsapp-webhook`
  4. envio `saida` via `whatsapp-send-text`.

Detalhes técnicos
- Não vamos alterar regra de negócio da Maya.
- Não vamos depender de `messages.upsert` como evento externo da Meta; isso segue apenas como evento interno sintético.
- A blindagem no `whatsapp-webhook` evita indisponibilidade por configuração divergente no callback.
- A telemetria no `whatsapp_meta_config` reduz troubleshooting de horas para minutos.
