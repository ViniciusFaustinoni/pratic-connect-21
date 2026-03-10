

# Inserir 35 faixas select/lagos/gasolina em `tabelas_preco_mensalidade`

## O que será feito

Criar uma migration SQL com o INSERT de 35 registros para `select | lagos | gasolina | particular`, FIPE de 0 a 180.000.

## Verificação

Rodar query agrupada. Resultado esperado: 3 linhas:
- select | lagos | gasolina | particular | 35 faixas | 0 → 180000
- select | rj | diesel | particular | 35 faixas | 0 → 180000
- select | rj | gasolina | particular | 35 faixas | 0 → 180000

Nenhum arquivo de código será alterado.

