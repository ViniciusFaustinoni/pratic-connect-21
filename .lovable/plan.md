

# Limpeza de registros sem `linha_slug` em `tabelas_preco_mensalidade`

## Implementação

Uma migration SQL para executar o DELETE:

```sql
DELETE FROM tabelas_preco_mensalidade
WHERE linha_slug IS NULL;
```

Após execução, verificação com:

```sql
SELECT 
  CASE 
    WHEN linha_slug IS NULL THEN 'sem_linha_slug (antigos)'
    ELSE 'com_linha_slug (novos)'
  END as tipo,
  COUNT(*) as registros
FROM tabelas_preco_mensalidade
GROUP BY (linha_slug IS NULL);
```

Resultado esperado: 0 registros (tabela vazia, pois todos os 48 registros atuais têm `linha_slug IS NULL`). Nenhum arquivo de código será alterado.

