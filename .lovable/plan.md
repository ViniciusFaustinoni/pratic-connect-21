
# Adicionar botao "Comunicar Imprevisto" nas telas de execucao do instalador

## Problema

O botao "Comunicar Imprevisto" existe apenas no card pre-execucao (`TarefaAtualCard`), mas **nao aparece** nas telas de execucao onde o instalador esta efetivamente realizando o servico:

- `InstaladorChecklist.tsx` (Instalacao)
- `ExecutarManutencao.tsx` (Manutencao)
- `ExecutarRetirada.tsx` (Retirada)

Ou seja, uma vez que o instalador clica em "Iniciar" e entra na tela de execucao, ele perde a opcao de comunicar imprevistos.

## Solucao

Reutilizar o componente `ImprevistoBotao` (que ja esta pronto com modal, motivos, duplo check e reagendamento) e adiciona-lo nas 3 telas de execucao.

### Arquivo 1: `src/pages/instalador/InstaladorChecklist.tsx`

- Importar `ImprevistoBotao` de `@/components/vistoriador/ImprevistoBotao`
- Adicionar o botao no header ou no rodape da tela, visivel em todas as etapas
- Passar os dados do servico (`id`, `associado.nome`, `associado.telefone`, `associado.whatsapp`)

### Arquivo 2: `src/pages/instalador/ExecutarManutencao.tsx`

- Importar `ImprevistoBotao`
- Adicionar o botao abaixo das informacoes do cliente, antes das acoes principais
- Usar os dados do servico para preencher as props

### Arquivo 3: `src/pages/instalador/ExecutarRetirada.tsx`

- Importar `ImprevistoBotao`
- Adicionar o botao no mesmo local (abaixo das informacoes do cliente)
- Usar os dados do servico para preencher as props

## Posicionamento do botao

Em todas as 3 telas, o botao sera colocado de forma visivel mas nao intrusiva:
- Nos headers das telas de execucao, logo abaixo dos dados do associado/veiculo
- Respeitando o estilo dark/slate ja usado nestas telas

## Resultado esperado

O instalador podera comunicar imprevistos a qualquer momento durante a execucao de uma instalacao, manutencao ou retirada, sem precisar voltar para a tela anterior.
