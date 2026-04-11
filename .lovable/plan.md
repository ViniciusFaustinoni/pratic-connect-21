

## Plano: Pin "Em Execução" no mapa de atribuições

### Problema
Quando um serviço está com status `em_andamento` (técnico executando), o pin no mapa:
1. Mostra botões de ação (Enviar Confirmação, WhatsApp, Google Maps, Cancelar Rota) que não fazem sentido
2. Tooltip mostra data/período em vez de indicar que está em execução
3. Cor do pin não diferencia dos demais

### Alterações em `MapaVistoriasContent.tsx`

**1. Nova cor para "em execução"**
- Adicionar constante `COR_EM_EXECUCAO = '#3B82F6'` (azul, consistente com a cor de `em_andamento` usada nos vistoriadores)
- Incluir `em_andamento` e `em_rota` no `getCorPorStatus` como primeiro check (antes de `STATUS_REALIZADOS`), retornando a cor azul

**2. Tooltip diferenciado**
- Na renderização do tooltip (linhas 585-603), quando `v.status === 'em_andamento'`, mostrar "🔧 Em execução" com tempo decorrido calculado a partir de `v.updated_at` (usando `formatDistanceToNow`)
- Cor de fundo do tooltip será azul (`COR_EM_EXECUCAO`)

**3. Remover botões do popup quando em execução**
- No bloco de botões (linhas 629-668), envolver com condição: só mostrar os botões se `v.status !== 'em_andamento'`
- No popup, substituir os campos normais por uma mensagem de "Serviço em execução" com tempo decorrido e nome do técnico

### Resultado
- Pin azul pulsante para serviços em execução
- Tooltip mostra "Em execução" + tempo decorrido
- Popup mostra apenas informações (sem botões de ação)

