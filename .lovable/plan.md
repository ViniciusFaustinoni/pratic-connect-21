
# Corrigir Header Content-Type na Resposta do whatsapp-send-text

## Problema

A mensagem e enviada com sucesso (status 200), mas o componente exibe "Erro ao enviar" porque:

1. A edge function `whatsapp-send-text` retorna o JSON de sucesso sem o header `Content-Type: application/json`
2. O SDK `supabase.functions.invoke` nao reconhece a resposta como JSON e retorna `data` como string
3. `data.success` resulta em `undefined` (pois `data` e uma string, nao um objeto)
4. A condicao `!data.success` e `true`, e o codigo lanca o erro

## Solucao

Adicionar `"Content-Type": "application/json"` ao header da resposta de sucesso na edge function `whatsapp-send-text/index.ts`.

## Alteracao

### `supabase/functions/whatsapp-send-text/index.ts`

Na resposta de sucesso (final do arquivo), trocar:

```text
return new Response(
  JSON.stringify({ success: true, message_id: result.key?.id, telefone: telefoneFormatado }),
  { headers: corsHeaders }
);
```

Por:

```text
return new Response(
  JSON.stringify({ success: true, message_id: result.key?.id, telefone: telefoneFormatado }),
  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

Isso garante que o SDK parse a resposta corretamente como JSON e `data.success` seja `true`.

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/whatsapp-send-text/index.ts` | Adicionar Content-Type: application/json na resposta de sucesso |
