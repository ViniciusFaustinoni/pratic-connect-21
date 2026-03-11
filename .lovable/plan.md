

# Corrigir Erro 3: OCR da CNH falhando na área do cliente (link público)

## Diagnóstico

A partir do screenshot do erro:
```
OCR error details: FunctionsHttpError: Edge Function returned a non-2xx status code
Upload error: Error: Edge Function returned a non-2xx status code
```

**Causa raiz confirmada**: dois problemas combinados:

1. **`document-ocr` NÃO está em `supabase/config.toml`** — ou seja, `verify_jwt = true` por padrão. Quando o usuário acessa o link público da cotação (não autenticado) e envia a CNH, a chamada `supabase.functions.invoke('document-ocr')` é rejeitada pelo gateway Supabase com 401 antes de a função sequer executar.

2. **`UnifiedDocumentUploader` usa o cliente `supabase` autenticado para chamar OCR** (linha 181), mas para o storage usa corretamente `publicSupabase` no fluxo público. Quando não há sessão de auth, o JWT enviado é o token anon cru, que pode falhar na verificação ou causar crash no `getClaims` (linha 390 da edge function).

## Plano

### 1. Adicionar `document-ocr` ao `config.toml` com `verify_jwt = false`
- A função já implementa validação de segurança interna (verifica se a URL é de buckets permitidos para requisições públicas)
- Isso permite que usuários do link público acessem o OCR

### 2. Corrigir `UnifiedDocumentUploader` para usar `publicSupabase` no fluxo público
- Quando `cotacaoId` está presente e `contratoId` ausente (fluxo público), usar `publicSupabase` para invocar `document-ocr`
- Garantir consistência: storage e OCR usando o mesmo cliente no fluxo público

### 3. Tornar auth mais robusta no edge function `document-ocr`
- Substituir `getClaims` (que pode não existir no SDK da edge function) por `getUser` que é mais confiável
- Envolver a verificação de auth em try-catch próprio para que falhas de auth não impeçam o processamento público

## Arquivos modificados
- `supabase/config.toml` — adicionar `[functions.document-ocr]` com `verify_jwt = false`
- `src/components/contratos/UnifiedDocumentUploader.tsx` — usar `publicSupabase` para OCR no fluxo público
- `supabase/functions/document-ocr/index.ts` — substituir `getClaims` por `getUser` com try-catch isolado

