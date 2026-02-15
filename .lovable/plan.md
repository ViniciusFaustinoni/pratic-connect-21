
# Renomear label de valor do orcamento para "Custo Medio Estimado de Mao de Obra"

## Contexto

O regulador precifica apenas mao de obra e servicos no orcamento -- pecas nao recebem valor (isso ja esta correto no codigo: `valorTotal` exclui itens do tipo `peca`). Porem, nas telas do analista de eventos, o total e exibido como "Valor total estimado" ou "Total", o que pode dar a impressao de que inclui pecas. O label correto deve ser **"Custo Medio Estimado de Mao de Obra"**.

## Alteracoes

### 1. `src/pages/eventos/SinistroAnalise.tsx` (linha 924)

Trocar o texto "Valor total estimado:" por "Custo medio estimado de mao de obra:".

### 2. `src/pages/analista-eventos/EventoAnaliseDetalhe.tsx` (linha 416 e 530)

- Linha 416 (tfoot da tabela): trocar "Total" por "Custo medio est. mao de obra"
- Linha 530 (resumo): trocar "Valor Orcamento:" por "Custo medio est. mao de obra:"

Nenhuma logica de calculo muda -- apenas os textos de exibicao.
