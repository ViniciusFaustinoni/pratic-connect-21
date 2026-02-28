
# Remover Seleção Manual de Tipo de Veículo na Autovistoria

## Problema

Na etapa de vistoria do link público, o sistema já sabe se o veículo é carro ou moto (campo `categoria` da cotação, extraído via CRLV/placa). Porém, ao clicar em "Autovistoria", o usuário é levado a uma tela intermediária pedindo para escolher manualmente entre "Automóvel" e "Moto" -- desnecessário e confuso.

## Solução

Eliminar a tela de seleção manual e usar diretamente o `tipoVeiculo` que já vem como prop (derivado de `cotacao.categoria`).

## Alteração

**Arquivo**: `src/components/cotacao-publica/EtapaVistoria.tsx`

1. **Botão "Autovistoria"** (linha 114): Ao clicar, ir direto para `'autovistoria'` em vez de `'selecao-veiculo'`
2. **Autovistoria** (linha 359): Usar `tipoVeiculo` (prop) diretamente, sem depender de `tipoSelecionado`
3. **Botão "Voltar" na autovistoria** (linha 349): Voltar para `'escolha'` em vez de `'selecao-veiculo'`
4. **Remover bloco inteiro** da tela de seleção de veículo (linhas 228-334) e o estado `tipoSelecionado` (linha 43), já que não serão mais necessários
5. **Remover `'selecao-veiculo'`** do type `ModoVistoria` (linha 27)

## Resultado

- Clicou em "Autovistoria" -> vai direto para as fotos (15 se carro, 10 se moto), sem etapa intermediária
- O tipo de veículo é determinado automaticamente pelo sistema com base nos dados do CRLV/placa
