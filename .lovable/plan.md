

# Fix: OCR CPF misreading — add digit permutation recovery

## Problem identified

The uploaded CNH-e has CPF `124.936.497-37` (valid). Both AI models (gemini-3-flash-preview and gemini-2.5-flash) consistently read it as `126.936.497-37` — confusing the digit `4` with `6`. The retry mechanism fails because the second model makes the same visual mistake, so CPF is marked as "ilegivel" even though it's perfectly readable.

The logs confirm this: both attempts return `126.936.497-37`.

## Root cause

Vision models commonly confuse similar-looking digits: 4↔6, 1↔7, 3↔8, 5↔6, 0↔8, 4↔9. When both attempts misread the same digit the same way, the current code gives up and marks the CPF as unreadable — forcing unnecessary manual input.

## Solution: deterministic digit permutation recovery

After both AI attempts fail validation, instead of giving up, try all single-digit substitutions of commonly confused pairs and validate each permutation's checksum. If exactly one permutation produces a valid CPF, use it.

This is deterministic, instant (no AI call needed), and mathematically guaranteed to be correct when only one digit is wrong.

### Changes

**File: `supabase/functions/document-ocr/index.ts`**

1. Add a `tryFixCPFByPermutation()` function:
   - Takes the invalid CPF string (11 digits)
   - Defines confusion pairs: `{0:[8,6], 1:[7,4], 3:[8], 4:[6,9], 5:[6,8], 6:[4,5,8,0], 7:[1], 8:[3,0,6], 9:[4,7]}`
   - For each digit position, try replacing with each confused alternative
   - Validate checksum on each permutation
   - If exactly ONE valid CPF is found → return it (confident fix)
   - If multiple valid CPFs found → return null (ambiguous)
   - If none found → return null

2. Insert this step between the retry failure and marking as "ilegivel" (around line 521):
   - When retry returns an invalid CPF, call `tryFixCPFByPermutation()`
   - If it finds a unique valid CPF, use it and log the correction
   - Only if permutation also fails, mark as "ilegivel"

3. Use `google/gemini-2.5-pro` for the retry (line 490) instead of `gemini-2.5-flash` — better vision accuracy for the AI retry step.

No frontend changes needed. No database changes needed.

### Technical detail

```text
Example: AI reads 126.936.497-37
         Digits: [1,2,6,9,3,6,4,9,7,3,7]
         
Position 2 (digit 6): try 4 → [1,2,4,9,3,6,4,9,7,3,7]
         = 124.936.497-37 → validateCPF ✓
         
Only 1 valid permutation found → use 124.936.497-37
```

The math guarantees: for any 11-digit number with exactly 1 wrong digit, there's almost always only one single-digit substitution (from the confusion set) that produces a valid CPF — because CPF has 2 check digits.

