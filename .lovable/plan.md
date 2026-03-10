

# Inserir 210 faixas lancamento (6 grupos x 35 faixas)

## O que será feito

1. Executar migration com INSERT de 210 registros na tabela `tabelas_preco_mensalidade` para `linha_slug = 'lancamento'`, cobrindo 6 combinações:
   - rj/gasolina, rj/diesel, lagos/gasolina, lagos/diesel, sp/gasolina, sp/diesel
2. Rodar query de verificação agrupada por regiao e combustivel_tipo

## Resultado esperado da verificação

| regiao | combustivel_tipo | total |
|--------|-----------------|-------|
| lagos  | diesel          | 35    |
| lagos  | gasolina        | 35    |
| rj     | diesel          | 35    |
| rj     | gasolina        | 35    |
| sp     | diesel          | 35    |
| sp     | gasolina        | 35    |

Nenhum arquivo de código será criado ou alterado.

