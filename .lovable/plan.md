

## Corrigir leitura de placa Mercosul no OCR de CRLV (caso `RKR3I57` lido como `RKR3157`)

### Diagnóstico
- O CRLV físico tem placa **Mercosul `RKR3I57`** (posição 5 = letra `I`).
- O Gemini está lendo a posição 5 como dígito `1` por ambiguidade visual (`I` vs `1` em fonte do CRLV) → entrega `RKR3157`.
- `RKR3157` casa com o regex de **placa antiga** (`AAA0000`), então `validatePlaca` aprova → nenhum retry, nenhuma correção.
- A função `extractCandidatesFromText` (fallback de texto nativo do PDF) usa o mesmo regex genérico, sem desambiguação posicional.
- A normalização posicional `LETTER_TO_DIGIT` / `DIGIT_TO_LETTER` que existe no `UnifiedDocumentUploader.tsx` só é acionada quando há **placa esperada para comparar** — não no fluxo padrão de leitura de CRLV.

### Solução (3 frentes complementares, edge function `document-ocr`)

#### 1. Normalizador posicional Mercosul-aware (servidor)
Criar helper `normalizePlacaMercosul(raw: string)` no `document-ocr/index.ts` que:
- Remove não-alfanuméricos e uppercase.
- Se 7 chars: aplica mapeamento por posição
  - índices 0,1,2 e **4** → forçar **letra** (`0→O, 1→I, 5→S, 8→B, 2→Z, 6→G`)
  - índices 3, 5, 6 → forçar **dígito** (`O→0, I→1, S→5, B→8, Z→2, G→6, T→7`)
- Retorna a placa "saneada".

#### 2. Detecção dupla: Mercosul vs antiga, com prioridade ao Mercosul quando ambíguo
Substituir a aceitação cega em `validatePlaca` por uma rotina que:
- Aplica `normalizePlacaMercosul` à placa retornada pela IA.
- Se o resultado **bate no padrão Mercosul** (`LLL N L NN`) **e** o original tinha algum caractere ambíguo na posição 4 (`1/I`, `0/O`, etc.), prefere a versão Mercosul.
- Mantém placa antiga válida quando todos os 4 últimos chars são genuinamente dígitos no doc original.
- Loga: `[OCR] Placa ajustada por normalização Mercosul: "RKR3157" → "RKR3I57"`.

#### 3. Reforço no prompt + extração de texto nativo
- **Prompt do Gemini** (seção `### CRLV`, linha ~161): adicionar instrução explícita:
  > "ATENÇÃO PLACA MERCOSUL: o 5º caractere é SEMPRE uma letra (A-Z). Nunca retorne dígito (0-9) na 5ª posição. Se visualmente parecer '1', leia como 'I'; '0' → 'O'; '5' → 'S'; '8' → 'B'. Se incerto entre letra e número na pos.5, escolha a LETRA."
- **`extractCandidatesFromText`** (caso `placa`): após capturar com regex genérico, devolver tanto a versão crua quanto a versão **normalizada Mercosul** como candidatos, para o validador escolher a correta.

#### 4. Re-validação final
Após todas as correções, rodar `validatePlaca` no resultado final. Se `RKR3I57` valida (Mercosul), grava `dados.placa = "RKR3I57"`. Caso contrário, mantém o que estava e registra `_motivos.placa_ambigua = true` para o operador revisar manualmente.

### Arquivos tocados

**Editado**
- `supabase/functions/document-ocr/index.ts` — adicionar `normalizePlacaMercosul`, ajustar pipeline de validação de placa (linhas ~50, ~160, ~835, ~967).

**Sem mudanças**
- Front (`UnifiedDocumentUploader.tsx`) — já tem a normalização posicional na comparação; vai continuar funcionando como segunda camada.
- Schema/banco — sem migration.

### Validação
1. Reenviar o CRLV do print (Renault Kwid, Mauro Cunha Siqueira) → OCR retorna `placa: "RKR3I57"` (não mais `RKR3157`).
2. Log da edge function mostra `[OCR] Placa ajustada por normalização Mercosul: "RKR3157" → "RKR3I57"`.
3. CRLVs com placas antigas legítimas (ex.: `ABC1234`) continuam sendo lidos corretamente — sem falso-positivo de Mercosul.
4. CRLVs Mercosul já lidos certo (ex.: `BRA2E19`) continuam idênticos (idempotente).
5. Cotação, contrato e SGA passam a usar `RKR3I57`, evitando falha de "placa não bate" em validações futuras.
6. Fluxo do `UnifiedDocumentUploader` quando o usuário digita placa esperada continua funcionando (segunda camada de defesa intacta).

