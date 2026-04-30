## Objetivo

Restaurar o OCR de documentos (CRLV, CNH, comprovante de residência etc.) após a troca para Anthropic e deixá-lo **mais preciso que antes**, eliminando os erros 500 vistos no `UnifiedDocumentUploader`.

## Causa raiz (confirmada nos logs)

`document-ocr` envia PDFs para a IA como `{ type: 'image_url', image_url: { url: 'data:application/pdf;base64,...' } }`. O adaptador Anthropic em `supabase/functions/_shared/ai-client.ts` traduz isso para um bloco `image` com `media_type: application/pdf`. A Anthropic rejeita (`Input should be 'image/jpeg'…'image/webp'`), retorna 400, e o `aiGatewayFetch` propaga como erro — sem cair no fallback Lovable. O frontend recebe 500.

A Anthropic suporta PDF, mas em **outro tipo de bloco**: `type: "document", source: { type: "base64", media_type: "application/pdf", data: ... }`.

## Mudanças

### 1. `supabase/functions/_shared/ai-client.ts` — adaptador Anthropic
- `toAnthropicMessage`: detectar data-URI com `application/pdf` e emitir bloco `{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }` em vez de `image`.
- Detectar URLs http(s) terminando em `.pdf` e emitir `{ type: "document", source: { type: "url", url } }`.
- Manter MIMEs de imagem suportados; quaisquer outros mimes não suportados (ex: `image/heic`) → converter para texto descritivo de erro em vez de quebrar a request.
- Adicionar header `anthropic-beta: pdfs-2024-09-25` quando o payload contiver bloco `document` (necessário em modelos < Sonnet 4; inofensivo em 4.5).

### 2. `supabase/functions/_shared/ai-client.ts` — fallback robusto
- Em `aiGatewayFetch`, quando `result.ok === false` e provider escolhido ≠ `lovable` e o erro é "recuperável" (status 4xx por incompatibilidade de payload, 5xx, ou timeout), tentar **automaticamente** uma 2ª chamada via Lovable Gateway antes de devolver erro.
- Logar claramente o motivo do fallback.

### 3. `supabase/functions/document-ocr/index.ts` — não devolver 500 para o client
- Capturar erros do AI gateway/Anthropic e devolver `200` com JSON `{ sucesso: false, sugestao: 'revisar', motivo: 'OCR temporariamente indisponível…', fallback: true }` para que o `UnifiedDocumentUploader` continue o upload sem quebrar a UI (o documento entra em `em_analise` para revisão manual — coerente com a regra global de revisão manual).
- Quando há texto nativo extraído via `unpdf` (já implementado) e a IA falha, **ainda** retornar `sucesso: true` com os dados parseados do texto + `confianca: 0.6` + `sugestao: 'revisar'`. Isso elimina o erro do usuário mesmo em pane total da Anthropic.

### 4. Qualidade superior (objetivo "melhor que o modelo anterior")
- Trocar o `OCR_MODEL` default da function para `claude-sonnet-4-5` (já é o configurado globalmente; remover qualquer hardcode antigo do tipo `gemini-flash` no `document-ocr`).
- Aumentar `max_tokens` de 2000 → 4096 para CRLV/CNH com muitos campos.
- Para PDFs: além do texto nativo via `unpdf`, enviar o PDF inteiro como `document` (Sonnet 4.5 lê layout + imagens internamente — qualidade superior ao "extrair imagem da página 1" que era a abordagem anterior).
- Manter retry automático com backoff já existente (`callAIGatewayWithRetry`).

### 5. Diagnóstico
- Adicionar log estruturado no início de cada chamada: `provider`, `model`, `mime`, `bytes`, `tipoEsperado`. Facilita auditoria futura.

## Validação

1. Login como diretor (`admin@teste.com`).
2. Abrir uma cotação, ir ao uploader de documentos.
3. Subir 1 PDF de CRLV + 1 imagem JPEG de comprovante + 1 PDF de CNH (mesmo cenário do log).
4. Verificar no preview que:
   - Os 3 documentos terminam com status definido (sem "Edge Function 500").
   - Console limpo de `FunctionsHttpError`.
   - Logs do `document-ocr` mostram `sucesso: true` para os 3, com bloco `document` no Anthropic.
5. Forçar provider para `anthropic` com chave inválida temporariamente (via UI) e confirmar que o fallback Lovable assume sem mostrar erro ao usuário.

## Fora de escopo

- Não tocar no fluxo de **assinatura** Autentique nem no detector de tipo (`tipo_detectado`) — funcionando.
- Não mexer no `UnifiedDocumentUploader` (frontend). A correção é toda server-side; o frontend já lida bem com `sucesso:false`.
