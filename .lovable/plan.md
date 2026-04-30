## Análise prévia

### Status do que foi pedido
- **#1 PDF como `type:"document"` para Anthropic** → **já implementado** no turno anterior em `_shared/ai-client.ts` (`toAnthropicMessage`). Não há retrabalho.
- **Anthropic como primeiro provedor** → **já é assim**: `ai_model_config` global aponta para `anthropic/claude-sonnet-4-5`; o `aiGatewayFetch` chama Anthropic primeiro e só cai em Lovable Gateway se houver erro recuperável.
- **#2 Logs estruturados** → parcial. Hoje há só um `[OCR][summary]` no fim. Falta logar entrada, mime, tipo de bloco, modelo, payload size e resposta do provedor.

### O que vale agir AGORA para "OCR mais certeiro" e debug claro

#### A. Logs estruturados em `document-ocr/index.ts`
Adicionar marcadores únicos por requisição (`reqId`) e logs JSON:
- `[OCR][in]` no início: `reqId`, `tipoEsperado`, `urlHash`, `isAuthenticated`.
- `[OCR][file]` após download: `mime`, `bytes`, `isPdf`, `hasNativeText`, `nativeTextLen`.
- `[OCR][ai_request]` antes de chamar IA: `model`, `provider` (lido de `ai_model_config`), `parts_count`, `block_types` (`["text","document"]` etc.), `max_tokens`.
- `[OCR][ai_response]` após resposta: `status`, `latencyMs`, `finish_reason`, `usage` (tokens), `content_chars`, `parsed_ok`.
- `[OCR][confidence]` no fim: `tipo_detectado`, `confianca`, `sugestao`, `usedRetry` (bool).

Adicionar logs equivalentes no `_shared/ai-client.ts`:
- `[ai-client][call]` com `provider`, `model`, `has_document_block`, `messages_count`.
- `[ai-client][resp]` com `provider`, `status`, `latencyMs`, `errorMessage` se houver.
- `[ai-client][fallback]` quando aciona Lovable Gateway, registrando o motivo.

#### B. Qualidade do OCR para documentos ruins
1. **Usar o modelo global em vez do hardcoded** — hoje `OCR_MODEL = 'google/gemini-2.5-flash'` ignora a config Anthropic. Trocar para deixar `aiGatewayFetch` resolver o modelo via `ai_model_config` (passar `model` como hint só para o caminho Lovable).
2. **Retry automático com modelo mais potente** quando o primeiro resultado vier com `confianca < 0.6`, `legivel === false` ou `sugestao === 'revisar'`. Hoje `OCR_RETRY_MODEL` está declarado mas nunca acionado nesse caso. Habilitar 1 retry com `claude-opus-4-5` (Anthropic) ou `gemini-2.5-pro` (Lovable fallback) e mesclar resultados pegando o de maior confiança.
3. **Reforço de prompt para baixa qualidade**: quando o PDF não tem texto nativo (`extractedPdfText` vazio) ou a imagem é grande (>2MB compactada), injetar parágrafo no prompt: "Documento provavelmente escaneado/foto de baixa qualidade. Use OCR rigoroso letra-a-letra; em campos numéricos, prefira a leitura mais provável e marque `confianca` < 0.7 se houver dúvida."
4. **Anti-alucinação**: instruir o modelo a retornar `null` (não inventar) em qualquer campo cuja leitura não esteja clara — já existe parcialmente no system prompt; reforçar para CPF/placa/CEP/data.

### O que NÃO vou fazer
- Não vou mexer na ordem de fallback (já está Anthropic → Lovable conforme pedido).
- Não vou re-implementar o suporte a PDF nativo (já está feito).
- Não vou tocar no frontend `UnifiedDocumentUploader` (já lida com `sucesso:false`).

## Validação
1. Login como diretor (`admin@teste.com`).
2. Subir 1 PDF de CRLV nítido + 1 foto de comprovante de baixa qualidade + 1 PDF escaneado.
3. Conferir nos logs do `document-ocr` (Supabase Functions):
   - `[OCR][in]`, `[OCR][file]`, `[OCR][ai_request]`, `[OCR][ai_response]`, `[OCR][confidence]` para cada upload.
   - `[ai-client][call]` mostrando `provider=anthropic, has_document_block=true` para o PDF.
   - Quando confiança < 0.6, ver `[OCR][retry]` seguido de novo `[OCR][ai_response]` e `usedRetry: true` no summary.
4. Confirmar que não há mais erro 500/400 no console do frontend.
