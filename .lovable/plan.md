
# Fix: CORS na Edge Function `document-ocr`

## Problema
A Edge Function `document-ocr` retorna headers CORS incompletos. O cliente Supabase JS v2 envia headers adicionais (`x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`) que nao estao listados no `Access-Control-Allow-Headers`, causando falha no preflight OPTIONS.

## Correcao
Atualizar a linha 7 de `supabase/functions/document-ocr/index.ts`:

```
// DE:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// PARA:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

Apenas 1 linha alterada, seguida de redeploy automatico.

## Arquivo afetado
- `supabase/functions/document-ocr/index.ts` (linha 7)
