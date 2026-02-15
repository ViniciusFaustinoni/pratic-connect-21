
# Remover posicionamento fixo do menu de Ações

## Problema
O card "Ações" (Aprovar Evento, Recusar Evento, Solicitar Documentos, etc.) está com a classe CSS `sticky top-4`, fazendo com que fique fixo na tela ao rolar a página. O comportamento correto é que ele role junto com o restante do conteúdo.

## Alteração

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx` (linha 1209)

Remover `sticky top-4` da classe do Card de Ações:
- De: `<Card className="sticky top-4">`
- Para: `<Card>`
