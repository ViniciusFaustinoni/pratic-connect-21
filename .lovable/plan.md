

## Causa raiz das falhas do OCR

Investiguei `supabase/functions/document-ocr/index.ts` (828 linhas) e o PDF de CNH que você anexou. Há **5 causas distintas** de falha, em ordem de impacto:

### 1) Extração de texto nativo do PDF está quebrada (impacto MÁXIMO)
A função `extractTextFromPDFBuffer` (linha 774) faz um regex `/\(([^)]*)\)/g` no buffer **bruto**, sem descomprimir streams. Mas o PDF da CNH Digital que você enviou usa `/Filter /FlateDecode` — todo o texto está **comprimido em zlib**. O regex retorna lixo binário ou ~0 caracteres úteis.

Resultado: a checagem `if (pdfText && pdfText.length > 50)` (linha 414) **quase sempre falha**, e o "TEXTO EXTRAÍDO DO PDF" que serviria de fonte primária para CPF/nome **nunca é injetado** no prompt. O sistema vira 100% dependente da leitura visual do Gemini, que erra dígitos parecidos (3↔8, 5↔6, 0↔8).

Foi exatamente o que aconteceu no seu print: CRLV leu tudo (o sistema acertou placa/renavam/chassi por sorte), mas CPF da CNH falhou.

### 2) Modelo escolhido é fraco para texto pequeno
Linha 262: `OCR_MODEL = 'google/gemini-2.5-flash-image'`. Esse modelo é otimizado para **geração/edição de imagens**, não para leitura precisa de texto. O modelo correto para OCR é `google/gemini-2.5-flash` (ou `pro` para máxima precisão). O retry usa `gemini-2.5-pro` — e por isso o retry costuma acertar quando o primeiro falha.

### 3) Imagens não são pré-processadas
O arquivo é enviado em base64 cru. Sem:
- Conversão de PDF→imagem (PDFs são enviados como `application/pdf` pra um modelo de visão, nem todos os providers entendem bem PDF multipágina via base64)
- Upscale para fotos baixa resolução (CPFs em fontes pequenas viram pixels borrados)
- Correção de orientação / contraste

### 4) Temperatura > 0 no primeiro passo
Linha 468: `temperature: 0.1`. Para OCR (tarefa determinística), o ideal é `0`. Pequenas variações já induzem alucinação em dígitos ambíguos.

### 5) Sem retry para outros campos além de CPF
Toda a lógica de "segunda tentativa com modelo melhor" (linhas 577–752) só existe para **CPF de CNH**. Se a IA errar placa, chassi, renavam, nome em comprovante, validade da CNH, etc. — não há retry, não há validação. O erro passa silenciosamente como "100% confiança" (que aliás é hardcoded em `_CONFIDENCE_` → `0.95`, linha 529 — a "confiança" exibida na UI **é fake**).

---

## Plano de correção

### Arquivo único: `supabase/functions/document-ocr/index.ts`

**A) Corrigir extração nativa de PDF** (resolve 70% dos casos)
- Substituir `extractTextFromPDFBuffer` por uso de `pdfjs-dist` via esm.sh (`https://esm.sh/pdfjs-dist@4`) — descomprime FlateDecode e extrai texto real página a página.
- Fallback: se pdfjs falhar (PDF escaneado puro), continuar com OCR visual.
- Quando texto nativo existir e contiver CPF/placa/renavam válidos por checksum, **usar como fonte primária** e só consultar a IA pra confirmar layout/tipo.

**B) Trocar o modelo padrão**
- `OCR_MODEL` → `google/gemini-2.5-flash` (não `-image`).
- Manter `gemini-2.5-pro` no retry.
- `temperature: 0` em ambos.

**C) Validação por checksum + retry para todos os campos críticos**
Generalizar o padrão do CPF para:
- **Placa** (regex ABC1234 ou ABC1D23)
- **Renavam** (11 dígitos + dígito verificador — algoritmo módulo 11)
- **Chassi** (17 chars, sem I/O/Q)
- **CPF** (já existe)
- **CNPJ** (módulo 11)

Se algum campo extraído falhar na validação → retry automático com `gemini-2.5-pro` + tool calling estruturado (mesmo padrão atual do CPF).

**D) Confiança real, não fake**
Remover o hack `_CONFIDENCE_ → 0.95` (linhas 135 e 529). Calcular confiança a partir de:
- Quantos campos passaram em validação por checksum (peso alto)
- Se veio do texto nativo do PDF (peso máximo) ou só visual (peso médio)
- Quantos campos vieram `null`/`ilegivel`

**E) Pré-processamento leve de imagem** (apenas se A–D não forem suficientes)
- Para imagens (não PDFs): se `< 1000px` no maior lado, pedir upscale via Gemini antes do OCR. Skip para simplicidade na primeira iteração; entrará só se A–D ainda deixar lacunas.

### Não mexer
- Estrutura de buckets, autenticação opcional, prompt principal (só pequenos ajustes), UI consumer, fluxo público de envio.

### Validação
1. Subir o **mesmo PDF de CNH Digital** que você anexou → CPF deve vir correto na 1ª tentativa (texto nativo).
2. Subir CNH em **foto borrada** → cair no retry visual com pro, ainda acertar ou retornar `ilegivel` (não inventar).
3. Subir CRLV em foto → placa/renavam/chassi validados por checksum.
4. Comprovante de residência → titularidade conforme hoje.

### Resultado esperado
- PDFs nativos (CNH Digital, CRLV-e, ATPV-e, faturas digitais): **~99% de acerto**, leitura instantânea via texto nativo, sem custo de IA visual no primeiro passo.
- Fotos: aumento de acerto significativo via modelo correto + retry universal + checksum.
- Confiança exibida passa a refletir realidade.

