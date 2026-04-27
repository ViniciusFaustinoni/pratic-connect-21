# Correção raiz do OCR — confusão 6↔8 em placas

## Causa raiz (já investigada)

Em fotos de CRLV antigo (papel verde, esmaecido), o modelo confunde `6` com `8` na 4ª/6ª/7ª posição da placa. Hoje:

1. O **prompt** só desambigua a 5ª posição (letra obrigatória do Mercosul). Os dígitos numéricos não têm regra explícita.
2. `gerarCandidatosPlaca` só faz swaps **letra↔dígito** (Mercosul vs antiga), nunca **dígito↔dígito**.
3. Cross-check com texto nativo do PDF só ajuda quando o documento é PDF — fotos JPG (caso reportado) não têm texto nativo.
4. Não validamos contra **veículos/cotações já cadastrados** no banco, que poderiam ancorar a leitura.

## Correções (mínimas, cirúrgicas)

### 1. `supabase/functions/document-ocr/index.ts` — Prompt (linhas 296–301)

Adicionar bloco específico para **dígitos numéricos** da placa, listando os pares confundíveis e instruindo o modelo a comparar visualmente o glifo com ocorrências do mesmo dígito no chassi/Renavam/Nº CRLV. Reforçar a proibição de copiar dígitos da "PLACA ANTERIOR" para a "PLACA" atual.

### 2. `supabase/functions/document-ocr/index.ts` — `gerarCandidatosPlaca` (linhas 66–97)

Expandir para emitir também variantes com swap **dígito↔dígito** nas posições numéricas:

- Mercosul: posições 3, 5, 6 — gerar variantes trocando 6↔8, 0↔8, 5↔6, 1↔7, 0↔9, 3↔8, 2↔7
- Antiga: posições 3, 4, 5, 6 — mesmas trocas

Limitar a no máximo **1 swap por candidato** para não explodir o conjunto (já cobre o caso comum). Resultado fica < 30 candidatos por placa.

### 3. `supabase/functions/document-ocr/index.ts` — Cross-check com banco (linhas 1224–1255)

Quando o OCR é foto (sem `extractedPdfText`) e há `cpfEsperado` no request, consultar `veiculos` e `cotacoes` cujo `associado/cliente` tenha aquele CPF e cuja placa esteja entre os candidatos expandidos. Se houver match único, usa essa placa.

Se não houver `cpfEsperado` ou nenhum match, **não força** — apenas registra log e mantém a leitura original (preserva fluxo de novo cadastro).

## Não muda

- Fluxo de detecção do tipo de documento
- Demais campos (chassi, renavam, CPF, CNH) — já têm tratamento
- Front-end (`useDocumentoOCR`) — interface continua igual

## Teste

1. Reenviar a foto do CRLV `LLL6C94` → deve retornar `LLL6C94` (não `LLL8C94`).
2. Reenviar uma foto de CRLV de placa antiga conhecida → não deve haver regressão.
3. CRLV de associado existente no banco → match por CPF deve travar a placa correta.

## Arquivo afetado

- `supabase/functions/document-ocr/index.ts` — 3 alterações localizadas
- Marcar relato `error_reports` correlato ao OCR como `concluido` após deploy.
