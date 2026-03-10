

# Inserir 210 faixas Select One (6 grupos x 35 faixas)

## O que será feito

Executar migration com INSERT de 210 registros na tabela `tabelas_preco_mensalidade` para `linha_slug = 'select-one'`, cobrindo 6 combinações:
- rj/particular, rj/aplicativo, lagos/particular, lagos/aplicativo, sp/particular, sp/aplicativo
- `combustivel_tipo = NULL` para todos
- `valor_desagio = NULL` para todos
- SP tem mesmo valor para particular e aplicativo

## Resultado esperado da verificação

| regiao | tipo_uso    | total |
|--------|-------------|-------|
| lagos  | aplicativo  | 35    |
| lagos  | particular  | 35    |
| rj     | aplicativo  | 35    |
| rj     | particular  | 35    |
| sp     | aplicativo  | 35    |
| sp     | particular  | 35    |

Nenhum arquivo de código será criado ou alterado.

