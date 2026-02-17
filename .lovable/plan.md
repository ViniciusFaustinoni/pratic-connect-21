
# Permitir Digitacao Livre no Campo "Tipo de Peca"

## Problema

O campo "Tipo de Peca" no componente `PecaSelectFields` usa um Combobox que so permite selecionar itens do catalogo predefinido (`CATALOGO_PECAS`). Se o regulador precisar informar uma peca que nao esta no catalogo, nao consegue.

## Solucao

Transformar o Combobox de "Tipo de Peca" para aceitar tanto selecao do catalogo quanto digitacao livre. Quando o texto digitado nao corresponder a nenhum item do catalogo, exibir uma opcao "Usar: [texto digitado]" que permite salvar o valor customizado.

## Alteracao

### Arquivo: `src/components/oficinas/PecaSelectFields.tsx`

No bloco do Combobox de "Tipo de Peca" (linhas 126-152):

- Adicionar estado local para rastrear o texto digitado no `CommandInput`
- Quando o texto nao corresponder a nenhum item do `CATALOGO_PECAS`, substituir o `CommandEmpty` por um `CommandItem` clicavel com o texto "Usar: [valor digitado]"
- Ao clicar nesse item, salvar o valor digitado como `tipoPeca` via `update({ tipoPeca: textoDigitado })`

Isso mantem a busca no catalogo funcionando normalmente, mas adiciona a opcao de valor livre quando nao ha correspondencia.

| Arquivo | Alteracao |
|---|---|
| `src/components/oficinas/PecaSelectFields.tsx` | Adicionar estado de busca no campo Tipo de Peca e opcao "Usar: [texto]" para digitacao livre |
