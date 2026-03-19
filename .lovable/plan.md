

# Fix: OCR CPF Extraction and Validation

## Problem
The AI model (Gemini) misreads CPF digits from CNH images. Example: real CPF might be `141.948.967-42` but the AI reads `126.936.497-37` — a visually plausible but mathematically invalid CPF. The AI even reports "extraído corretamente" with 0.99 confidence.

## Root Cause
1. **No server-side CPF checksum validation** in the `document-ocr` edge function after extraction
2. **No retry with checksum feedback** when the extracted CPF fails validation
3. **Frontend accepts the raw OCR value** without immediate correction attempt

## Solution

### 1. Add CPF validation + automatic retry in `document-ocr` edge function

After the AI returns a CPF for a CNH document:
- Validate the CPF checksum (implement the same `validateCPF` algorithm in the edge function)
- If invalid, **retry** with a focused prompt that tells the AI: "The CPF you extracted (`XXX`) has invalid checksum digits. Re-read the document carefully, digit by digit."
- If retry also fails validation, mark the CPF as `"ilegivel"` so the frontend forces manual input
- This applies to both the initial extraction and the existing CPF retry flow

### 2. Improve system prompt for CPF accuracy

Add to the system prompt:
- Instruction to read each CPF digit individually, left to right
- Warning that CPF has mathematical checksum — if digits are uncertain, flag as `"ilegivel"` rather than guessing

### 3. Frontend: auto-trigger manual correction

In `EtapaDadosPessoaisDocumentos.tsx`:
- When OCR returns CPF as `"ilegivel"`, immediately show the manual input field with a clear message
- The existing `cpfManual` state and validation logic already handles this — just need to detect `"ilegivel"` and activate it

## Files to Change

1. **`supabase/functions/document-ocr/index.ts`**
   - Add `validateCPF()` function (port from `src/lib/validations`)
   - After line 436 (OCR result received): validate `result.dados.cpf` checksum
   - If invalid: retry with corrective prompt including the wrong CPF for reference
   - If retry still invalid: set `result.dados.cpf = "ilegivel"`
   - Apply same logic to the existing CPF retry block (lines 438-493)

2. **`src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`**
   - Detect `dadosExtraidos.cpf === "ilegivel"` and auto-show manual CPF input
   - Show specific toast: "CPF não pôde ser lido do documento. Digite manualmente."

## Technical Detail: CPF Validation in Deno

```typescript
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cleaned[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cleaned[10]);
}
```

## Expected Outcome
- OCR extracts CPF → validates checksum → retries if wrong → marks as `ilegivel` if still wrong
- Frontend detects `ilegivel` → shows manual input immediately
- No invalid CPF ever enters the database automatically

