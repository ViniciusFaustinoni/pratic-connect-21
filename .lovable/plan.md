

## Diagnóstico: IA processou mas resposta não foi enviada

### Problema Identificado

A mensagem "Bati de carro" do Marcus (5521992593830) às 14:36 foi:
- ✅ Recebida e salva no banco pelo `whatsapp-meta-webhook`
- ✅ Delegada para `whatsapp-webhook`
- ✅ Processada pela IA (resposta salva em `chat_mensagens_ia` às 14:36:37)
- ❌ **Nunca enviada** — zero registros de saída em `whatsapp_mensagens`

A causa é um **timeout em cadeia de 3 Edge Functions**:

```text
Meta API → whatsapp-meta-webhook → whatsapp-webhook → (IA loop) → whatsapp-send-text
              Edge Function #1         Edge Function #2                Edge Function #3
```

O `whatsapp-webhook` executa o loop da IA (contexto + histórico + até 5 tool calls), consome todo o tempo disponível, e dá timeout antes de chamar `sendWhatsAppViaProxy`. A resposta da IA é salva no banco mas nunca é enviada ao WhatsApp.

### Solução Proposta

Implementar **envio assíncrono** no `whatsapp-webhook` para delegações Meta. Em vez de aguardar todo o loop de IA dentro da mesma requisição, o fluxo será:

1. **`whatsapp-meta-webhook`**: Recebe, salva no banco, e retorna 200 para a Meta imediatamente
2. **Processamento IA**: Executado na mesma function mas com resposta já enviada à Meta
3. **Fallback de segurança**: Se o loop de IA falhar/timeout, uma verificação periódica (ou retry) detecta mensagens sem resposta

**Alteração principal no `whatsapp-meta-webhook`** (linhas 93-109):
- Usar `waitUntil` pattern ou `EdgeRuntime.waitUntil` não é suportado no Supabase
- Alternativa: Fazer a delegação para `whatsapp-webhook` de forma fire-and-forget (não aguardar o await da resposta) para que o webhook retorne 200 à Meta rapidamente
- Adicionar timeout explícito na chamada fetch para o `whatsapp-webhook` (AbortController com 140s)
- Adicionar log de erro quando timeout ocorre

**Alteração no `whatsapp-webhook`** (linhas 3379-3384):
- Adicionar try/catch explícito ao redor do `sendWhatsAppViaProxy` com fallback de log
- Se o envio falhar, salvar a resposta como "pendente" para reprocessamento

### Arquivos a Editar
- `supabase/functions/whatsapp-meta-webhook/index.ts` — Fire-and-forget na delegação + timeout
- `supabase/functions/whatsapp-webhook/index.ts` — Try/catch robusto no envio + log de fallback

### Impacto
- Marcus e outros associados que mandarem mensagem via Meta API receberão as respostas da IA corretamente
- O webhook retornará 200 para a Meta mais rapidamente, evitando que a Meta desabilite o webhook

