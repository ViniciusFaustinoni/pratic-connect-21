

# Adicionar Busca nos Dropdowns do Formulario de Pecas

## Problema

Os quatro dropdowns (Tipo de Peca, Marca, Modelo, Ano) usam o componente `Select` do Radix, que nao possui campo de busca. Com listas longas (ex: marcas FIPE tem 90+ itens, modelos podem ter 200+), o usuario precisa rolar manualmente para encontrar o item desejado.

## Solucao

Substituir os quatro `Select` por comboboxes com campo de busca, usando o padrao `Popover + Command` ja existente no projeto (referencia: `ContaCombobox.tsx`).

Cada dropdown tera:
- Um botao que abre um popover
- Campo de busca (digitacao filtra a lista)
- Lista filtrada de opcoes
- Checkmark no item selecionado

## Arquivo a Modificar

`src/components/oficinas/AutoCenterPecaFormDialog.tsx`

## Detalhes Tecnicos

### Imports adicionais

- `Popover, PopoverTrigger, PopoverContent` de `@/components/ui/popover`
- `Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem` de `@/components/ui/command`
- `Check, ChevronsUpDown` de `lucide-react`
- `cn` de `@/lib/utils`

### Substituicoes

Os quatro campos do formulario serao convertidos de `Select` para o padrao Popover+Command:

1. **Tipo de Peca** -- lista estatica `CATALOGO_PECAS`, busca por texto
2. **Marca** -- lista dinamica `marcas[]`, busca por nome
3. **Modelo** -- lista dinamica `modelos[]`, busca por nome
4. **Ano** -- lista dinamica `anos[]`, busca por nome

Cada um tera um state `open` proprio (ex: `openPeca`, `openMarca`, `openModelo`, `openAno`) para controlar o popover individualmente.

A logica de cascata (selecionar marca carrega modelos, selecionar modelo carrega anos) permanece inalterada.

