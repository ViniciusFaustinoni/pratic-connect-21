

# Fix: Leitura de Documentos Lenta e Não Funcional

## Problemas Identificados

1. **Processamento sequencial**: Quando múltiplos documentos são enviados, cada um espera o anterior terminar (`for...of` com `await`). 3 docs = 3x o tempo.

2. **Modelo lento**: Usa `google/gemini-2.5-flash` para OCR principal e `google/gemini-2.5-pro` (ainda mais lento) para retry de CPF. O modelo padrão recomendado agora é `google/gemini-3-flash-preview`, que é mais rápido.

3. **System prompt gigante (232 linhas)**: Enviado inteiramente em toda requisição, mesmo para docs simples. Aumenta latência e custo de tokens.

4. **max_tokens: 4000**: Excessivo para a maioria dos documentos. Um CRLV completo retorna ~500 tokens.

## Solução

### 1. Processar documentos em paralelo (Frontend)
No `UnifiedDocumentUploader.tsx`, trocar o loop sequencial por `Promise.allSettled` para processar todos os arquivos simultaneamente.

### 2. Trocar modelo para gemini-3-flash-preview (Edge Function)
Modelo principal: `google/gemini-3-flash-preview` (mais rápido).
Retry de CPF: `google/gemini-2.5-flash` em vez de Pro.

### 3. Reduzir max_tokens
Principal: 4000 → 2000 (suficiente para qualquer documento).
Retry CPF: já está em 200, manter.

### 4. Otimizar system prompt
Compactar instruções redundantes e exemplos extensos, mantendo todas as regras. Reduzir de ~232 linhas para ~120 linhas.

## Arquivos Alterados

- `supabase/functions/document-ocr/index.ts` — modelo, max_tokens, prompt otimizado
- `src/components/contratos/UnifiedDocumentUploader.tsx` — processamento paralelo

