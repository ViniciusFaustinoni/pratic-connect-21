

# Adicionar coluna `valor_desagio` em `tabelas_preco_mensalidade`

## Implementação

Uma única migration SQL:

```sql
ALTER TABLE tabelas_preco_mensalidade ADD COLUMN IF NOT EXISTS valor_desagio numeric;
```

Após execução, verificação com:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tabelas_preco_mensalidade'
ORDER BY ordinal_position;
```

Resultado esperado: coluna `valor_desagio` do tipo `numeric`, nullable YES. Nenhum arquivo de código será alterado.

