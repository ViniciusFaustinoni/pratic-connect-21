
# Fix: 1a Parcela deve exibir apenas o valor da Adesao

## Problema
Atualmente, o campo "1a Parcela" no Resumo da Cotacao soma Adesao + Mensalidade. O correto e exibir apenas o valor da Adesao, pois a mensalidade sera cobrada separadamente conforme regras de afiliacao.

## Alteracoes

### 1. `src/pages/vendas/Cotador.tsx`

Tres pontos de correcao:

- **Linha 1421** (card de comparacao de planos): Mudar de `planoAtual.valorAdesao + planoAtual.valorMensal + valorExtra` para apenas `planoAtual.valorAdesao`

- **Linha 1519** (resumo final da cotacao): Mudar de `planoFinalSelecionado.valorAdesao + planoFinalSelecionado.valorMensal + valorExtra` para apenas `planoFinalSelecionado.valorAdesao`

- **Linha 758** (mensagem WhatsApp): Mudar de `planoFinalSelecionado.valorAdesao + planoFinalSelecionado.valorMensal` para apenas `planoFinalSelecionado.valorAdesao`

### 2. `src/hooks/useCalcularCotacao.ts`

- **Linha 88**: Mudar `valor_primeira_parcela: valores.mensal + valores.adesao` para `valor_primeira_parcela: valores.adesao`

Isso corrige automaticamente a pagina publica da cotacao (`CotacaoPublicaCompleta.tsx`) que ja usa `plano.valor_primeira_parcela`.

## Arquivos alterados
1. `src/pages/vendas/Cotador.tsx` — 3 pontos de calculo
2. `src/hooks/useCalcularCotacao.ts` — 1 ponto de calculo

## Resultado
- "1a Parcela" exibe apenas o valor de Adesao em todas as telas (cotador, resumo, WhatsApp, pagina publica)
- Mensalidade continua sendo exibida separadamente no campo "Mensal"
