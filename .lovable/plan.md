

# Fix: admin-reset-password CORS + duplicate variable

## Problems

1. **CORS**: `Access-Control-Allow-Headers` is missing `x-supabase-client-platform` and related headers that the Supabase JS client sends automatically. The preflight OPTIONS request fails because the server doesn't acknowledge these headers.

2. **Duplicate `const supabaseServiceKey`**: Declared on line 46 AND line 76. This causes a runtime error in Deno (`SyntaxError: redeclaration of const`), which means the OPTIONS handler never even runs properly.

## Fix

In `supabase/functions/admin-reset-password/index.ts`:

1. Update `corsHeaders` to include all required headers:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

2. Remove the duplicate `const supabaseServiceKey` on line 76 — reuse the one already declared on line 46.

Single file change, deploy will be automatic.

