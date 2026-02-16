
# Corrigir Formatacao das Mensagens da IA para WhatsApp

## Problema

A IA gera mensagens com formatacao Markdown (ex: `**negrito**`, `## titulo`, `- lista`) em vez de usar a formatacao nativa do WhatsApp (`*negrito*`, `_italico_`, `~tachado~`). Isso faz com que os asteriscos duplos e outros caracteres Markdown aparecam como texto cru no WhatsApp.

## Causa Raiz

Os system prompts das edge functions que geram mensagens para WhatsApp nao proibem explicitamente o uso de Markdown. O modelo de IA tende naturalmente a usar Markdown (`**bold**`) em vez do formato WhatsApp (`*bold*`).

## Solucao

Adicionar instrucoes explicitas nos prompts das duas edge functions que geram texto para WhatsApp via IA.

### 1. `supabase/functions/whatsapp-webhook/index.ts`

No `WHATSAPP_SYSTEM_PROMPT` (linha 267-269), reforcar a regra de formatacao:

```text
## Regras do WhatsApp
- Seja CONCISO (mensagens curtas)
- Use formatação do WhatsApp: *negrito* (um asterisco), _itálico_ (underline), ~tachado~ (til)
- NUNCA use formatação Markdown: **duplo asterisco**, ## títulos, [links](url), ```código```
- NÃO use marcadores especiais como [BOTAO_LOCALIZACAO] ou [UPLOAD_*]
```

### 2. `supabase/functions/gerar-mensagem-whatsapp/index.ts`

No `systemPrompt` (linhas 60-63), adicionar regra explicita:

```text
REGRAS IMPORTANTES:
1. Seja amigável e profissional
2. Use emojis de forma moderada (não exagere)
3. Formate para WhatsApp: use *negrito* (UM asterisco) para destaques
4. NUNCA use formatação Markdown como **duplo asterisco**, ## títulos ou [links](url)
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar proibicao explicita de Markdown no WHATSAPP_SYSTEM_PROMPT |
| `supabase/functions/gerar-mensagem-whatsapp/index.ts` | Adicionar proibicao explicita de Markdown no systemPrompt |

Nenhuma outra edge function e afetada - as mensagens hardcoded (autentique-webhook, retroativo, notificar-sinistro, etc.) ja usam o formato correto `*negrito*`.
