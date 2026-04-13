

## Plano: Submeter Template Meta e Corrigir Envio via Template

### Problema
1. O template `aprovacao_fipe_diretoria_v1` foi inserido na tabela `whatsapp_meta_templates` com status `PENDING`, mas nunca foi submetido à API da Meta para aprovação real
2. A Edge Function `notificar-diretoria-fipe` envia texto livre via `whatsapp-send-text` com `allow_text: true`, ignorando o template Meta

### Solução

**1. Criar Edge Function para submeter template à Meta**
- Criar `whatsapp-submit-template/index.ts` que chama a API da Meta (`POST /{WABA_ID}/message_templates`) para submeter o template `aprovacao_fipe_diretoria_v1`
- Usar as credenciais Meta já configuradas no sistema (buscar `meta_whatsapp_token` e `meta_whatsapp_waba_id` da tabela `configuracoes`)
- Atualizar status na tabela `whatsapp_meta_templates` para o retornado pela Meta
- Invocar essa função uma vez para submeter o template

**2. Atualizar `notificar-diretoria-fipe` para usar template Meta**
- Substituir o envio de texto livre pelo envio via template Meta estruturado
- Usar `template_name: 'aprovacao_fipe_diretoria_v1'` com parâmetros posicionais `[marca, modelo, ano, placa, valorFipe, limite, nomeAssociado]`
- Chamar `whatsapp-send-text` com `template_name` e `template_params` em vez de `mensagem` + `allow_text`
- Fallback: se o template não estiver APPROVED, enviar como texto livre (manter comportamento atual como backup)

**3. Verificar estrutura do `whatsapp-send-text`**
- Confirmar que a Edge Function `whatsapp-send-text` aceita `template_name` e `template_params` para envio via Meta API
- Se não aceitar, ajustar para suportar envio de templates Meta com parâmetros

### Escopo
- 1 nova Edge Function (`whatsapp-submit-template`)
- 1 Edge Function editada (`notificar-diretoria-fipe`)
- Possível edição em `whatsapp-send-text` se necessário
- Deploy de 2-3 funções

