## Objetivo
Garantir que a mensagem enviada manualmente pelo operador apareça imediatamente e permaneça no histórico da conversa, além de continuar chegando corretamente ao associado no WhatsApp.

## Causa raiz
A edge function `supabase/functions/whatsapp-send-text/index.ts` envia o texto pela Meta com sucesso, mas na hora de registrar em `whatsapp_mensagens` grava `status='enviada_texto_livre'`.

Esse valor não é aceito pelo schema atual da tabela, que só permite:
- `pendente`
- `enviando`
- `enviada`
- `entregue`
- `lida`
- `erro`
- `cancelada`

Como o `insert` pós-envio não tem tratamento explícito de erro, o usuário vê sucesso no envio, o associado recebe a mensagem, mas ela não fica persistida no banco e portanto não aparece no chat.

## Implementação

### 1) Corrigir a edge function de envio
Ajustar `supabase/functions/whatsapp-send-text/index.ts` para que mensagens de texto livre enviadas manualmente sejam persistidas com um status válido do schema.

Abordagem recomendada:
- trocar `enviada_texto_livre` por `enviada`
- manter a distinção de canal via campos já existentes, como `tipo='text'` e `provedor='meta_oficial'`

Também vou endurecer o fluxo para não mascarar falhas de persistência:
- validar o resultado do `insert` em `whatsapp_mensagens`
- se a gravação falhar, registrar erro de forma explícita nos logs da edge function

### 2) Alinhar a UI do chat com o status canônico
Revisar `src/components/eventos/chat-ia/ChatPanel.tsx` para garantir que a bolha e o indicador visual de envio continuem funcionando com o status canônico `enviada`.

Hoje a UI já entende `enviada`, então a tendência é não precisar alterar comportamento visual — apenas confirmar consistência.

### 3) Validar a listagem e persistência da conversa
Conferir os pontos de leitura para garantir que nada depende do status inválido:
- `src/hooks/useWhatsAppHistorico.ts`
- `src/pages/eventos/EventosChatIA.tsx`

A expectativa é que, após a correção na persistência, a mensagem manual já passe a aparecer automaticamente na conversa e na lista lateral.

## Resultado esperado
Depois da correção:
- o operador envia a mensagem
- o associado recebe normalmente
- a linha é gravada em `whatsapp_mensagens`
- a conversa atualiza e a mensagem permanece visível no histórico

## Detalhes técnicos
Arquivos previstos:
- `supabase/functions/whatsapp-send-text/index.ts`
- possível revisão leve em `src/components/eventos/chat-ia/ChatPanel.tsx`
- possível revisão leve em `src/hooks/useWhatsAppHistorico.ts`
- possível revisão leve em `src/pages/eventos/EventosChatIA.tsx`

Observação importante:
- não pretendo alterar o schema do banco para aceitar `enviada_texto_livre`, porque isso só perpetuaria um status paralelo sem necessidade real
- a solução raiz é alinhar a edge function ao contrato já existente da tabela