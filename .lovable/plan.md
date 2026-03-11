

# Drop Legacy Pricing Tables

## Verification Complete
- **Foreign keys check**: 0 references found — safe to drop
- **Records**: 12 inactive records in `tabelas_preco`, 0 in the other two
- **Code references**: None in `.ts`/`.tsx` files (only auto-generated `types.ts`)

## Migration SQL

```sql
-- Drop legacy pricing tables (no longer referenced by code or FK constraints)
-- tabelas_preco had 12 inactive records (all ativo=false), migrated to tabelas_preco_mensalidade
DROP TABLE IF EXISTS tabelas_preco_historico;
DROP TABLE IF EXISTS tabelas_preco_adesao;
DROP TABLE IF EXISTS tabelas_preco;
```

## Post-migration
- Supabase types will auto-regenerate, removing legacy table types from `types.ts`
- Expected result: only `tabelas_preco_mensalidade` remains

## Files modified
- New migration file only (no code changes needed)

