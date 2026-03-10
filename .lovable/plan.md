

# Inserir 142 faixas Especial na tabela tabelas_preco_mensalidade

## O que será feito

Inserir 142 registros via migration SQL na tabela `tabelas_preco_mensalidade` para `linha_slug = 'especial'`:

- **RJ gasolina**: 23 faixas
- **RJ diesel**: 23 faixas
- **Lagos gasolina**: 23 faixas
- **Lagos diesel**: 23 faixas
- **SP gasolina**: 23 faixas (idêntico Lagos)
- **SP diesel**: 23 faixas (idêntico Lagos)

Regras aplicadas:
- `tipo_uso = 'particular'` para todos
- `valor_desagio = NULL` para todos
- `combustivel_tipo` preenchido (gasolina ou diesel)
- Faixas vão até R$120.000 apenas (24 faixas por combustível/região, contando a primeira de 0-10k)

Colunas: `linha_slug, regiao, combustivel_tipo, tipo_uso, fipe_min, fipe_max, valor_mensal, valor_desagio, is_active`

## Verificação

Após inserção, executar:
```sql
SELECT regiao, combustivel_tipo, COUNT(*) as total
FROM tabelas_preco_mensalidade
WHERE linha_slug = 'especial'
GROUP BY regiao, combustivel_tipo
ORDER BY regiao, combustivel_tipo;
```

Resultado esperado:

| regiao | combustivel_tipo | total |
|--------|-----------------|-------|
| lagos  | diesel          | 23    |
| lagos  | gasolina        | 23    |
| rj     | diesel          | 23    |
| rj     | gasolina        | 23    |
| sp     | diesel          | 23    |
| sp     | gasolina        | 23    |

Nenhum arquivo de código será criado ou alterado.

