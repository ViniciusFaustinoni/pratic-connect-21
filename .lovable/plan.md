

# Tornar campos Marca/Modelo/Ano pesquisáveis no modal de cotação

## O que muda
Substituir os 3 `Select` simples (Marca, Modelo, Ano) por comboboxes pesquisáveis usando Popover + Command (cmdk), mantendo a hierarquia FIPE (Marca → Modelo → Ano).

## Implementação

### 1. Criar `src/components/ui/searchable-select.tsx`
Componente reutilizável com Popover + Command que aceita:
- `options: { value: string; label: string }[]`
- `value`, `onValueChange`, `placeholder`, `disabled`, `loading`
- `searchPlaceholder`

O usuário digita no CommandInput e o cmdk filtra as opções automaticamente (fuzzy match nativo).

### 2. Editar `src/components/cotacoes/CotacaoFormDialog.tsx` (linhas 1445-1517)
Trocar os 3 `Select` por `SearchableSelect`, mantendo mesma ordem (Marca → Modelo → Ano) e mesmos handlers (`handleMarcaChange`, `handleModeloChange`, `setAnoSelecionado`).

```text
Antes:  Select → scroll manual sem filtro
Depois: SearchableSelect → digita para filtrar, clica para selecionar
```

Nenhuma lógica de dados ou dependência entre campos é alterada.

