
# Corrigir: IA não cria eventos (sinistros/assistências) no App nem no WhatsApp

## Causa Raiz Confirmada

Ambos os sistemas usam o modelo `google/gemini-3-flash-preview`, que **não retorna `tool_calls` de forma confiável** via `ai.gateway.lovable.dev`. Sem `tool_calls`, o loop de execução de ferramentas nunca entra, e as tools `criar_solicitacao_sinistro` e `criar_solicitacao_assistencia` nunca são chamadas — nenhum registro é criado no banco.

### Arquivos afetados

| Arquivo | Linhas com o modelo | Uso |
|---|---|---|
| `supabase/functions/assistente-chat/index.ts` | 1167, 1233 | App do associado |
| `supabase/functions/whatsapp-webhook/index.ts` | 1853 (função `callAI`) | WhatsApp (IA principal e confirmações de agendamento) |

### Por que o modelo falha

O modelo `gemini-3-flash-preview` é uma versão **preview** que ainda não tem suporte estável a function calling no formato OpenAI. Ele responde em texto puro, sem o campo `tool_calls` na resposta. O código checa:

```
while (assistantMessage?.tool_calls && iterations < maxIterations)
```

Como `tool_calls` é `undefined`, o loop nunca executa — a IA apenas escreve uma resposta textual dizendo que "criou" o evento, mas nada acontece no banco.

## Solução

Trocar o modelo por `google/gemini-2.5-flash`, que tem suporte estável a function calling no formato OpenAI e é o substituto direto recomendado para este caso de uso.

### Arquivos a alterar

**1. `supabase/functions/assistente-chat/index.ts`**
- Linha 1167: trocar modelo na chamada inicial
- Linha 1233: trocar modelo na chamada de follow-up (loop de tool_calls)

**2. `supabase/functions/whatsapp-webhook/index.ts`**
- Linha 1853: trocar modelo na função `callAI` (usada por toda a IA do WhatsApp)

### Adição de log diagnóstico

Adicionar log em ambas as funções para registrar quando o modelo não retorna `tool_calls`, facilitando debug futuro:

```typescript
// Após receber a resposta do modelo
if (!assistantMessage?.tool_calls) {
  console.log(`[assistente-chat] Modelo retornou texto puro (sem tool_calls). finish_reason: ${result.choices?.[0]?.finish_reason}`);
}
```

### Deploy

Após as alterações, fazer deploy de ambas as edge functions:
- `assistente-chat`
- `whatsapp-webhook`

## Resultado esperado

- Ao solicitar sinistro ou assistência pelo App, a IA chama a tool correta e o evento é criado no banco com status `comunicado`
- O evento aparece imediatamente na tela de Pré-Análise do painel admin
- Ao solicitar pelo WhatsApp, o mesmo fluxo funciona corretamente
- A IA confirma ao associado o protocolo real retornado pela tool (não inventado)
