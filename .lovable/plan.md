

# Tornar `categoria` e `tipo_uso` nullable em `tabelas_preco_mensalidade`

## O que será feito

Uma migration SQL com:

```sql
ALTER TABLE tabelas_preco_mensalidade
  ALTER COLUMN categoria DROP NOT NULL,
  ALTER COLUMN tipo_uso DROP NOT NULL;
```

## Verificação

Após execução, rodar:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tabelas_preco_mensalidade'
ORDER BY ordinal_position;
```

Resultado esperado: `categoria` e `tipo_uso` com `is_nullable = YES`.

Nenhum arquivo de código será alterado.

