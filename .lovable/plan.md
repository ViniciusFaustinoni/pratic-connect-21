

# Adicionar coluna `combustivel_tipo` em `tabelas_preco_mensalidade`

## Implementação

Uma única migration SQL:

```sql
ALTER TABLE tabelas_preco_mensalidade ADD COLUMN IF NOT EXISTS combustivel_tipo varchar(30);
```

Após execução, verificação com:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tabelas_preco_mensalidade'
ORDER BY ordinal_position;
```

Nenhum arquivo de código será alterado.

