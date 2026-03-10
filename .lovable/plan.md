

# Fix: Duplicate variable declaration in `delete-associado` edge function

## Problem

The edge function `delete-associado` crashes on boot with:
```
SyntaxError: Identifier 'supabaseServiceKey' has already been declared
```

`supabaseServiceKey` is declared twice with `const` — on line 41 and line 57. This prevents the function from even starting, causing "Failed to fetch" on the frontend.

## Fix

**File:** `supabase/functions/delete-associado/index.ts`

Remove the duplicate declaration on line 57 and reuse the existing `adminClient` pattern (or just reuse the variable from line 41):

- Line 57: Remove `const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;`
- Line 58: Change to `const adminClient = createClient(supabaseUrl, supabaseServiceKey);` (already uses the variable from line 41)

This is a one-line deletion. The function will then boot correctly and the delete operation will work again.

| File | Change |
|---|---|
| `supabase/functions/delete-associado/index.ts` | Remove duplicate `const supabaseServiceKey` on line 57 |

