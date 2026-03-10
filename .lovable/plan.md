

# Desativar faixas de planos inativos em `tabelas_preco`

## Implementação

Uma migration SQL para executar o UPDATE:

```sql
UPDATE tabelas_preco
SET ativo = false
WHERE plano_id IN (
  SELECT id FROM planos WHERE ativo = false
);
```

Após execução, verificação com query para confirmar que planos inativos têm apenas faixas inativas.

Nenhum arquivo de código será alterado.

