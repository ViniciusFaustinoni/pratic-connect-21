## Problema

No **Relacionamento › Chat**, mensagens digitadas pelo atendente humano não chegam ao associado. A IA responde normalmente, mas o envio manual "some".

## Causa raiz

O `ChatPanel.tsx` (`handleEnviar`) invoca a edge function `whatsapp-send-text` apenas com `{ telefone, mensagem }`.

Quando o provedor ativo é a **Meta API** (caso atual em produção), `whatsapp-send-text/index.ts` só envia texto livre quando o caller passa `allow_text: true`. Sem essa flag, a função cai no bloco de **auto-fallback de template** (linha 267 do edge): substitui a mensagem digitada pelo template aprovado `notificacao_atendimento_pratic`, jogando o texto do atendente como variável de "detalhes".

Resultado prático:
- O associado recebe (na melhor hipótese) uma notificação genérica de "Atualização PRATIC" — não a resposta do atendente.
- Se o template fallback não estiver APPROVED/habilitado, o envio é bloqueado com erro registrado em `whatsapp_mensagens.status='erro'`.
- A IA funciona porque ela já é chamada com o contexto correto via webhook.

Atendimento humano sempre ocorre **dentro da janela de 24h** (porque é uma resposta a uma conversa aberta pelo associado), então texto livre é o caminho correto e legítimo pela Meta.

## Correção

**1 arquivo, 1 linha de mudança efetiva** em `src/components/eventos/chat-ia/ChatPanel.tsx`:

Adicionar `allow_text: true` no body do invoke de `whatsapp-send-text` dentro de `handleEnviar`:

```ts
const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
  body: { telefone, mensagem: texto.trim(), allow_text: true },
});
```

## Fora de escopo

- `whatsapp-send-media` (envio de áudio/arquivo) — mídia não passa pelo fallback de template, segue funcionando.
- Edge function `whatsapp-send-text` — sem mudanças; o comportamento atual está correto (proteção contra disparos automáticos de texto livre fora da janela).
- Outros call sites que disparam templates programáticos — devem continuar sem `allow_text`.

## Validação

Após o deploy:
1. Entrar como admin em **Relacionamento › Chat**.
2. Abrir uma conversa com transbordo ativo.
3. Enviar uma mensagem de texto.
4. Conferir no WhatsApp do associado que chega o texto exato digitado (não um template).
5. Conferir em `whatsapp_mensagens` que a linha tem `provedor='meta_oficial'`, `status='enviada_texto_livre'`, `tipo='text'`.
