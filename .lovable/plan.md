

# Alteração: Adicionar coluna `linha_slug` em `tabelas_preco_mensalidade`

## Estado atual da tabela

A tabela `tabelas_preco_mensalidade` tem 9 colunas:

| Coluna | Tipo | Nullable |
|---|---|---|
| id | uuid | NO |
| tipo_uso | character varying | NO |
| categoria | character varying | NO |
| fipe_min | numeric | NO |
| fipe_max | numeric | NO |
| valor_mensal | numeric | NO |
| regiao | character varying | YES |
| is_active | boolean | YES |
| created_at | timestamp with time zone | YES |

A coluna `linha_slug` **não existe** ainda.

## Implementação

Uma única migration SQL:

```sql
ALTER TABLE tabelas_preco_mensalidade
ADD COLUMN IF NOT EXISTS linha_slug varchar(50);
```

Resultado esperado: coluna `linha_slug` do tipo `character varying`, nullable YES, sem default.

Nenhum arquivo de código será alterado.

