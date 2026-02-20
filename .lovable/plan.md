
# Corrigir: IA Presa em Loop Infinito de Processamento (504 Timeout)

## Diagnóstico Confirmado

Os logs de rede do Supabase mostram claramente o problema:

```
OPTIONS | 504 | assistente-chat | execution_time_ms: 160.023ms
```

A edge function `assistente-chat` está retornando **HTTP 504 Gateway Timeout** após 160 segundos — ultrapassando o limite de ~150s do Supabase. O cliente fica esperando uma resposta que nunca chega, resultando no "Digitando..." infinito.

**Causas Identificadas:**

1. **Modelo muito lento**: Ambas as functions usam `google/gemini-2.5-flash`. Para conversas simples (como relato de colisão), este modelo é mais lento do que o necessário.

2. **Loop de 5 iterações de tool calls**: O loop `while (assistantMessage?.tool_calls && iterations < maxIterations)` pode fazer até 5 chamadas seguidas à API de IA, multiplicando o tempo total.

3. **Sem timeout explícito nas chamadas fetch**: As chamadas ao gateway de IA não têm `AbortSignal` com timeout, então ficam aguardando indefinidamente até o timeout do Supabase.

4. **`whatsapp-webhook`**: Mesmo modelo (`gemini-2.5-flash`) e mesma lógica de loop.

## Solução

### Parte 1 — Trocar o modelo para `google/gemini-3-flash-preview` (mais rápido)

O modelo `google/gemini-3-flash-preview` é descrito na documentação como *"fast preview"* e *"balanced speed and capability"* — ideal para conversas em tempo real com tool calling. Trocar em ambas as functions:

- `supabase/functions/assistente-chat/index.ts` (linhas 1218 e 1300)
- `supabase/functions/whatsapp-webhook/index.ts` (linha 1853)

### Parte 2 — Adicionar timeout nas chamadas fetch ao gateway de IA

Adicionar `AbortSignal.timeout(25000)` (25 segundos por chamada) para que, se uma chamada individual à IA demorar demais, ela falhe rapidamente com um erro tratável em vez de bloquear a função inteira:

```typescript
signal: AbortSignal.timeout(25000), // 25 segundos máximo por chamada
```

Isso garante que, mesmo no pior caso (5 iterações × 25s), a função completa em ~125s — abaixo do limite de 150s.

### Parte 3 — Reduzir o número máximo de iterações

Reduzir `maxIterations` de `5` para `3` em `assistente-chat`. Para casos normais de sinistro, 3 iterações são suficientes (1ª chamada → tool → resposta final). Isso reduz o tempo máximo de processamento.

```typescript
const maxIterations = 3; // Reduzido de 5 para 3
```

### Parte 4 — Adicionar resposta de fallback em caso de timeout

Quando uma chamada individual ao gateway de IA falhar por timeout (erro `AbortError`), retornar uma mensagem amigável em vez de travar:

```typescript
if (error.name === 'TimeoutError' || error.name === 'AbortError') {
  return new Response(JSON.stringify({ 
    error: "O serviço de IA está demorando mais que o esperado. Por favor, tente novamente." 
  }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/assistente-chat/index.ts` | Trocar modelo para `gemini-3-flash-preview`, adicionar timeout de 25s, reduzir `maxIterations` de 5 para 3 |
| `supabase/functions/whatsapp-webhook/index.ts` | Trocar modelo para `gemini-3-flash-preview`, adicionar timeout de 25s |

## Resultado Esperado

- Resposta da IA em 5-15 segundos (antes: 150s+ com timeout)
- Eliminação do "Digitando..." infinito no app
- WhatsApp responde normalmente
- Em casos extremos de lentidão: mensagem de erro amigável ao invés de loop infinito
