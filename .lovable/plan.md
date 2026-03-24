

# Diagnostico: OCR de Documentos com Falhas

## Investigacao

Analisei completamente a edge function `document-ocr/index.ts` (811 linhas) e os hooks que a chamam. **Nao ha logs recentes** da funcao, o que indica que ela pode estar falhando no boot ou nao sendo invocada corretamente.

## Problemas identificados

### 1. Import XHR obsoleto causa crash no boot (CRITICO)
Linha 1: `import "https://deno.land/x/xhr@0.1.0/mod.ts"` — este polyfill XHR e antigo e pode causar falha de inicializacao em versoes mais recentes do Deno runtime usado pelo Supabase Edge Functions. A funcao `odometro-ocr` (que funciona) **nao usa este import**.

### 2. Modelo sem sufixo `-image` para visao (CRITICO)
Linha 246: `const OCR_MODEL = 'google/gemini-2.5-flash'` — a funcao `odometro-ocr` (que funciona) usa `google/gemini-2.5-flash-image`. O modelo sem sufixo pode nao suportar inputs de imagem, causando erro 400 do gateway.

### 3. `getClaims` pode nao existir na versao do SDK (MEDIO)
Linha 268: `supabase.auth.getClaims(token)` — este metodo foi adicionado recentemente ao supabase-js. Embora esteja em try-catch, se o import do SDK falhar por incompatibilidade, toda a funcao cai.

### 4. Extracao nativa de PDF extremamente fragil (BAIXO)
Linhas 757-811: `extractTextFromPDFBuffer` faz parsing via regex de bytes brutos. Nao funciona com streams comprimidos (a maioria dos PDFs modernos). Isso nao causa erro, mas o fallback visual via IA pode falhar se o modelo estiver errado (item 2).

## Plano de correcao

| Alteracao | Arquivo | Detalhes |
|-----------|---------|----------|
| Remover import XHR | `supabase/functions/document-ocr/index.ts` | Deletar linha 1 — `fetch` nativo do Deno e suficiente |
| Corrigir modelo de IA | `supabase/functions/document-ocr/index.ts` | `OCR_MODEL = 'google/gemini-2.5-flash-image'` e `OCR_RETRY_MODEL = 'google/gemini-2.5-pro'` (retry pode manter sem sufixo pois usa tool calling) |
| Redeploy e testar | Edge Function | Redeployar e verificar logs para confirmar que o boot e as chamadas funcionam |

Sao 2 alteracoes simples no mesmo arquivo + redeploy. Nenhuma funcionalidade sera removida ou alterada.

