

# Limpeza de `tabelas_preco_adesao`

## Implementação

Uma migration SQL com o DELETE:

```sql
DELETE FROM tabelas_preco_adesao;
```

Após execução, verificação com:

```sql
SELECT COUNT(*) as registros_restantes FROM tabelas_preco_adesao;
```

Resultado esperado: `registros_restantes = 0` (todos os 12 registros removidos). Nenhum arquivo de código será alterado.

