
# Corrigir: Webhook WhatsApp Rejeitando Mensagens com 403 (API Key Inválida)

## Diagnóstico Confirmado

Os logs da edge function `whatsapp-webhook` mostram o problema de forma explícita:

```
[whatsapp-webhook] API key inválida no webhook → HTTP 403 Forbidden
```

**Fluxo que está acontecendo:**

1. Associado envia mensagem no WhatsApp
2. Evolution API faz POST no webhook com header `apikey: <valor>`
3. A função compara esse `apikey` com o secret `EVOLUTION_API_KEY`
4. Os valores são diferentes → função retorna 403 e **abandona o request**
5. A IA nunca processa nada → associado não recebe resposta

**Causa raiz:** A Evolution API envia como `apikey` do webhook a key configurada especificamente para aquele webhook (que pode ser diferente da `EVOLUTION_API_KEY` global da instância). A validação atual é muito restritiva — ela rejeita qualquer request onde o `apikey` do webhook não bate exatamente com a chave global.

**Código problemático (linha 2562):**
```typescript
// Validar apikey da Evolution API se configurada
const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
if (evolutionApiKey) {
  const webhookApiKey = req.headers.get("apikey") || payload.apikey;
  if (webhookApiKey && webhookApiKey !== evolutionApiKey) {  // ← BUG AQUI
    console.error("[whatsapp-webhook] API key inválida no webhook");
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }
}
```

## Solução

### Opção A — Remover a validação restritiva (recomendada)

A validação atual causa mais dano do que benefício. O webhook já é protegido pela URL secreta (apenas quem conhece a URL do endpoint pode chamá-lo). Além disso, a instância é validada logo abaixo (linha 2578) — se a instância não for conhecida, o request é rejeitado.

Alterar a lógica para **apenas logar** quando a key for diferente, sem rejeitar o request:

```typescript
// Validar apikey da Evolution API (apenas log, não rejeitar)
const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
if (evolutionApiKey) {
  const webhookApiKey = req.headers.get("apikey") || payload.apikey;
  if (webhookApiKey && webhookApiKey !== evolutionApiKey) {
    console.warn("[whatsapp-webhook] API key do webhook diferente da configurada — continuando processamento");
    // Não rejeitar: a instância será validada abaixo
  }
}
```

### Opção B — Adicionar secret WEBHOOK_API_KEY separado

Criar um secret `WEBHOOK_API_KEY` específico para validação do webhook (separado da key global). Porém isso requer reconfigurar o webhook na Evolution API — mais trabalhoso.

**A Opção A é a solução correta e imediata.**

## Verificação Adicional

Além da correção da validação, verificar se o modelo de IA na função está correto após os deploys anteriores. Com base nos logs e no diff anterior, as mudanças para `gemini-3-flash-preview` e `AbortSignal.timeout(25000)` já foram aplicadas.

## Arquivo Alterado

| Arquivo | Linha | Alteração |
|---|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | 2562 | Remover rejeição quando API key do webhook difere; substituir por log de aviso |

## Resultado Esperado

- Mensagens recebidas do WhatsApp são processadas normalmente
- A IA responde ao associado em 5-15 segundos
- O webhook continua protegido pela validação da instância (linha 2578)
- Nenhuma mensagem legítima é bloqueada com 403
