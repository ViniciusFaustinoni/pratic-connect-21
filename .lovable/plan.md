

## Plano: Exigir fotos antes de permitir recusa do veículo (Vistoria de Instalação)

### Problema
Hoje o técnico pode recusar/negar um veículo sem tirar nenhuma foto. Isso impede análises futuras, já que muitos associados tentam entrar várias vezes e as fotos são evidências importantes.

### Correção

**Dois arquivos afetados** (os dois fluxos de vistoria de instalação):

#### 1. `src/pages/instalador/ExecutarVistoriaCompleta.tsx`
- O botão "Reprovar" (linha 565) atualmente só verifica `processando`
- Adicionar condição: desabilitar o botão se `!todasFotosEnviadas`
- Mostrar mensagem informativa abaixo do botão quando fotos faltam, ex: "Tire todas as fotos obrigatórias antes de reprovar"

#### 2. `src/pages/instalador/InstaladorChecklist.tsx`
- O botão "Registrar Recusa do Veículo" (linha 1889) aparece quando `decisaoInstalador === 'negado'`
- Verificar quantas fotos obrigatórias da etapa de fotos foram tiradas
- Desabilitar o botão se as fotos obrigatórias não estiverem completas
- Mostrar mensagem informativa indicando que as fotos são necessárias mesmo para recusa

### Resultado
O técnico será obrigado a tirar todas as fotos obrigatórias do veículo antes de poder registrar uma recusa, garantindo evidências fotográficas para análises futuras.

