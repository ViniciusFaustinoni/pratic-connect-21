

## Plano: Aumentar raio de detecção do drag-and-drop

### Problema
O raio de proximidade para atribuição por drag-and-drop é de 800m. Na prática, os pins raramente ficam tão próximos, causando falhas frequentes.

### Solução
Aumentar o raio de **0.8 km para 5 km** na linha 698 de `MapaVistoriasContent.tsx`. Isso permite soltar o técnico em qualquer lugar razoavelmente perto do serviço. Como o sistema já mostra a distância real na confirmação, não há risco de atribuição acidental.

### Alteração
- **`src/components/mapa/MapaVistoriasContent.tsx`** linha 698: trocar `0.8` por `5`
- Atualizar mensagem de erro (linha 708) para refletir o novo raio

