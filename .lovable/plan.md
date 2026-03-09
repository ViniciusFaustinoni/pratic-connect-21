

# Adicionar `preview_url: true` para mensagens com links via Meta API

## Contexto

Atualmente, a função `whatsapp-send-text` bloqueia completamente texto livre via Meta (só permite templates). No entanto, dentro da janela de 24h (quando o contato interagiu), texto livre COM links é válido e deveria usar `preview_url: true` para gerar preview do link.

Há dois cenários onde isso se aplica:

1. **Texto livre dentro da janela 24h** — atualmente bloqueado, mas a Meta permite
2. **Captions em mídias** — `whatsapp-send-media` já envia captions, mas não tem `preview_url`

## Alterações

### Arquivo: `supabase/functions/whatsapp-send-text/index.ts`

**1. Adicionar helper para detectar URLs no texto:**
```typescript
function contemLink(texto: string): boolean {
  return /https?:\/\/\S+/i.test(texto);
}
```

**2. Modificar o bloco de texto livre (L148-161) na função `enviarViaMeta`:**

Em vez de bloquear totalmente, permitir texto livre quando explicitamente solicitado (novo param `allow_text: true` para respostas dentro da janela 24h — usado pela Maya/chatbot). O corpo do payload fica:

```typescript
metaBody = {
  messaging_product: "whatsapp",
  to: telefoneFormatado,
  type: "text",
  text: {
    preview_url: contemLink(mensagem),
    body: mensagem,
  },
};
```

O bloqueio permanece como default (mensagens proativas sem template continuam bloqueadas), mas um novo parâmetro `allow_text` no body da request permite bypass para cenários legítimos (respostas da Maya, mensagens dentro da janela).

**3. Atualizar o MAIN (L220-227) para extrair o novo parâmetro:**
```typescript
const allow_text = body.allow_text || false;
```

E passá-lo para `enviarViaMeta`.

### Arquivo: `supabase/functions/whatsapp-send-media/index.ts`

Nenhuma alteração necessária — captions em mídias não suportam `preview_url` na API da Meta (é exclusivo do tipo `text`).

## Resumo

- Adicionar `preview_url: true` automaticamente quando a mensagem contém URL
- Permitir texto livre via Meta com flag `allow_text` (para respostas na janela 24h)
- Manter bloqueio padrão para mensagens proativas sem template
- Re-deploy da edge function `whatsapp-send-text`

