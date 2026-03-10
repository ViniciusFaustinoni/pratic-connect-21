

# Inserir 35 faixas select/sp/gasolina

## O que será feito

1. Executar INSERT de 35 registros na tabela `tabelas_preco_mensalidade` para a combinação `select | sp | gasolina | particular`, FIPE de 0 a 180.000
2. Rodar query de verificação: `SELECT COUNT(*) ... WHERE linha_slug='select' AND regiao='sp' AND combustivel_tipo='gasolina'`

## Detalhes técnicos

- Será utilizada a migration tool do Supabase para executar o INSERT
- Nenhum arquivo de código será criado ou alterado
- Resultado esperado da verificação: **35**

