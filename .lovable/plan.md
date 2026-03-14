

# Remover foto duplicada "Local de Instalação do Rastreador" da grade de fotos

## Problema
Durante a vistoria de instalação, a foto "Local de Instalação do Rastreador" aparece **duas vezes**:
1. Na grade de fotos da vistoria (categoria "Instalação") — primeira tela
2. Na seção dedicada "Local de Instalação do Rastreador" com select de local + descrição + foto — segunda tela

A seção dedicada (item 2) é mais completa e é a correta. A foto na grade (item 1) deve ser removida.

## Solução
Alterar a lógica de `agruparFotosFiltradas` no `InstaladorChecklist.tsx` para **nunca incluir** a categoria `instalacao` na grade de fotos, já que essa informação é capturada separadamente na seção dedicada do checklist.

### Alteração em `src/pages/instalador/InstaladorChecklist.tsx`
- Linha ~247: Mudar `agruparFotosFiltradas(tipoVeiculo, veiculoPrecisaRastreador)` para `agruparFotosFiltradas(tipoVeiculo, false)` — isso exclui a categoria `instalacao` da grade de fotos
- A seção dedicada de local de instalação (linha ~1719) permanece inalterada

Isso garante que a foto do local do rastreador seja pedida apenas uma vez, na seção dedicada com select + descrição + foto.

