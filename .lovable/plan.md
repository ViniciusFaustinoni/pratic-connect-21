

# Permitir desmarcar "Tipo de Placa" no formulário de cotação

## Problema
O campo "Tipo de Placa" usa um `Select` que não permite limpar a seleção após escolher um valor.

## Solução
Adicionar uma opção "Nenhuma" no topo da lista de opções do select, com value `"nenhuma"`. O sistema já trata `tipoPlacaSelecionado !== 'nenhuma'` nas linhas 373 e 1168, então a lógica de negócio já está preparada.

## Alteração

### `src/components/cotacoes/CotacaoFormDialog.tsx` (~linha 1579)
- Adicionar `<SelectItem value="nenhuma">Nenhuma</SelectItem>` como primeira opção dentro do `<SelectContent>`, antes da lista dinâmica de tipos de placa.

| Arquivo | Ação |
|---|---|
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Adicionar opção "Nenhuma" no select de tipo de placa |

