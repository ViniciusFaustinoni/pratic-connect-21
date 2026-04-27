# Correção raiz do OCR

## Diagnóstico (o que está realmente quebrado)

Analisei os logs reais da edge function `document-ocr` e o código. Existem **três causas raiz** independentes que, combinadas, explicam a inconsistência ("ora lê, ora não") e a sensação de "travar":

### 1. Extração nativa de texto de PDF está 100% quebrada
Em **todos** os PDFs processados, o log mostra:
```
[OCR] pdfjs falhou ao extrair texto: Setting up fake worker failed:
"Module not found: https://esm.sh/pdfjs-dist@4.0.379/denonext/legacy/build/pdf.worker.mjs".
[OCR] PDF sem texto nativo suficiente (0 chars), usando OCR visual
```
O import atual (`pdfjs-dist@4.0.379/legacy/build/pdf.min.mjs`) tenta carregar um worker que não existe no Deno edge runtime. Resultado: **toda CNH/CRLV/comprovante em PDF perde a fonte de texto mais precisa** e fica dependente apenas da visão da IA — exatamente o que gera leituras inconsistentes do mesmo documento.

### 2. Não há timeout nem retry no chamador → percepção de "trava"
`useDocumentoOCR` e o fluxo público chamam `supabase.functions.invoke('document-ocr')` **sem timeout** e **sem retry**. Quando o gateway de IA fica lento (>30s) ou retorna 5xx esporádico, a UI fica esperando indefinidamente — é o "OCR travou" relatado.

### 3. A própria edge function não tem retry em falhas transitórias do gateway
Quando o Lovable AI Gateway responde 500/502/503/504 (acontece sob carga), a função aborta na primeira tentativa e devolve "Erro ao processar documento com IA". O mesmo documento processado segundos depois funciona — daí a intermitência.

A imagem que você anexou (conta de luz da Light) **foi lida corretamente** no último teste (log às 20:30:51) — extraiu nome, endereço, bairro, CEP, data corretos. O problema não é o conteúdo do documento; é a infraestrutura de leitura.

---

## Plano de correção

### Correção 1 — Consertar extração nativa de PDF (raiz do problema #1)
Substituir o pdfjs-dist (que requer worker) por **`unpdf`** — biblioteca feita exatamente para runtimes serverless/Deno, sem worker, sem dependência de canvas. Editar `supabase/functions/document-ocr/index.ts`:

- Trocar o import `pdfjs-dist` → `unpdf` (`https://esm.sh/unpdf@0.12.1`).
- Reescrever `extractTextFromPDFBuffer` para usar `extractText(pdf, { mergePages: true })`.
- Manter o fallback silencioso (se falhar, segue para visão pura — comportamento atual já é correto).

Resultado: CNH, CRLV, ATPV-e, comprovantes e propostas em PDF passam a ter texto nativo extraído. O CPF, RG, placa, chassi, renavam, CEP serão lidos do **texto real** (sem ambiguidade visual) e a IA usará a imagem só para confirmar layout — exatamente como o sistema já está preparado para fazer (toda a lógica de "texto nativo como referência primária" já existe, só nunca tinha texto pra usar).

### Correção 2 — Retry com backoff dentro da edge function (raiz do problema #3)
Encapsular as chamadas `fetch('https://ai.gateway.lovable.dev/...')` em uma função `callAIGatewayWithRetry()`:
- Até **3 tentativas** em respostas 500/502/503/504 e em erros de rede.
- Backoff exponencial: 500ms, 1500ms, 3500ms.
- **NÃO** retentar em 401/402/429 (erros legítimos que devem chegar ao usuário).
- Aplicar nas 3 chamadas: principal, retry de CPF, retry de número de motor.

### Correção 3 — Timeout e retry no front-end (raiz do problema #2)
Atualizar `src/hooks/useDocumentoOCR.ts` e o caller direto em `src/components/cotacao-publica/DocumentosPendentesPublico.tsx`:
- **Timeout de 90s** por chamada usando `AbortController` (PDFs grandes + retries internos cabem nisso).
- **2 tentativas** se a primeira retornar erro de rede ou timeout.
- Em caso de falha total, gravar o documento mesmo assim (status `pendente`, sem dados OCR) — analista revê manualmente. Nunca deixar o usuário travado.

### Correção 4 — Logging estruturado para diagnóstico futuro
Adicionar no início do processamento: log único com `{ url, fileSize, mimeType, hasNativeText, model }` e no fim: `{ success, tipo_detectado, confianca, durationMs, retries }`. Isso permite, em qualquer relato futuro, identificar em segundos se o problema foi gateway lento, PDF sem texto, ou modelo errando.

---

## Arquivos afetados

- `supabase/functions/document-ocr/index.ts` — trocar pdfjs por unpdf, adicionar `callAIGatewayWithRetry`, logs estruturados.
- `src/hooks/useDocumentoOCR.ts` — timeout + retry.
- `src/components/cotacao-publica/DocumentosPendentesPublico.tsx` — usar a nova lógica de timeout/retry.
- Status do relato de erro #4 (Joanna) será movido para **em_tratamento** ao iniciar e para **concluído** ao final, para você testar.

## O que NÃO vou mexer
- O prompt do sistema (já está muito refinado, não é a causa).
- Validações de checksum (CPF/CNPJ/Renavam/Chassi) — já funcionam.
- Fluxos de upload, storage, ou status de documento.

## Como você vai testar depois
1. Reenviar a mesma conta de luz que já oscilou — deve ler 100% das vezes.
2. Reenviar uma CNH em PDF — verá o `confianca` subir e o CPF sempre validar checksum.
3. Forçar uma falha (desconectar internet por 5s no meio do upload) — UI mostra erro claro em até 90s, sem travar.
