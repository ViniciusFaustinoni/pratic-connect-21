
# Alterar Label "Rastreador GPS" para "Rastreador GPS - No Momento do Evento"

## Problema

O label "Rastreador GPS" no card de comparacao de posicoes nao deixa claro para o analista que a posicao mostrada e do momento do evento, e nao a posicao atual do veiculo.

## Alteracao

### Arquivo: `src/components/sinistros/ComparacaoPosicoes.tsx`

Linha 236 - alterar o texto do label:

- De: `Rastreador GPS`
- Para: `Rastreador GPS - No Momento do Evento`

Alteracao minima de uma unica linha, sem impacto em nenhum outro comportamento.
