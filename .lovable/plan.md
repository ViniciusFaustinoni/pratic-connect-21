

# Diagnóstico: Mensagens Meta API não entregues

## Problema Confirmado

As mensagens estão sendo **aceitas** pela Meta API (retornam `message_id` como `wamid.HBg...`) mas **não são entregues** aos destinatários. Evidência:

- **221 mensagens** com status `enviada`, apenas **9** com status `entregue`
- Todas as mensagens recentes via `meta_oficial` têm `template_id: null` e `tipo: text` -- são **texto livre**
- O status é `enviada` (não `enviada_texto_livre`) -- confirmando que as edge functions da última correção **não foram deployadas com sucesso**

## Causa Raiz

O deploy anterior falhou com `SUPABASE_CODEGEN_ERROR` (connection reset do esm.sh). O redeploy seguinte pode não ter persistido. As funções em produção **ainda são as versões antigas** sem mapeamento de templates.

## Plano

### 1. Redeployar as 3 edge functions

Forçar o redeploy de:
- `whatsapp-send-text` (com diferenciação de status `enviada_texto_livre`)
- `notificar-cliente` (com `META_TEMPLATE_MAP` expandido)
- `atribuir-proxima-tarefa` (com template para notificação do profissional)

### 2. Testar o envio com template

Após deploy, invocar `whatsapp-send-text` com um template aprovado (`assistencia_confirmada`) para confirmar que a Meta entrega a mensagem.

### 3. Verificar logs pós-deploy

Confirmar nos logs que o template está sendo usado (log `Usando template Meta 'xxx'`).

