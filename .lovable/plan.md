

# Plano: Corrigir rolagem e multi-seleção colapsável de Marcas/Modelos

## Problemas identificados

1. **Rolagem quebrada**: O `SearchableSelect` usa `Popover` com `modal={false}`, que dentro de um `Dialog` + `ScrollArea` causa problemas de sobreposição e scroll
2. **Seleção única**: Atualmente so permite selecionar uma marca por vez (adiciona uma, depois outra)
3. **Modelos nao aparecem colapsáveis**: Marcas devem ser colapsáveis mostrando modelos dentro

## Alterações

### 1. `MarcaModeloExclusionEditor.tsx` — Substituir SearchableSelect por lista colapsável multi-seleção

Remover o padrão atual de "selecionar marca + botão adicionar" e substituir por:

- Um campo de busca (input text simples) no topo para filtrar marcas
- Lista de marcas como itens colapsáveis (usando `Collapsible`) com checkbox
- Ao expandir uma marca, mostra os modelos daquela marca com checkboxes individuais
- Marcar a marca inteira = todos modelos incluídos/excluídos
- Marcar modelos individuais = regra específica por modelo
- Múltiplas marcas e modelos podem ser selecionados simultaneamente
- A lista inteira fica dentro de um `ScrollArea` com altura fixa (max-h-64) para resolver o problema de scroll
- Ao marcar/desmarcar, salva a regra automaticamente (sem botão "Adicionar")

### 2. `SearchableSelect` (Popover) — Corrigir modal para uso dentro de Dialog

- Alterar `modal={false}` para `modal={true}` no Popover para evitar conflitos de scroll dentro de Dialogs

### Estrutura visual

```text
┌─ Inclusão por Marca / Modelo ─────────────────┐
│ [Blacklist ▪] [Whitelist]                      │
│                                                │
│ 🔍 Filtrar marcas...                           │
│ ┌────────────────────────── max-h-64 scroll ─┐ │
│ │ ▼ ☑ CHEVROLET                              │ │
│ │     ☑ ONIX                                 │ │
│ │     ☑ TRACKER                              │ │
│ │     ☐ CRUZE                                │ │
│ │ ▶ ☐ FIAT                                   │ │
│ │ ▼ ☑ TOYOTA                                 │ │
│ │     ☑ (todos modelos)                      │ │
│ │ ▶ ☐ VOLKSWAGEN                             │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ 3 marcas selecionadas, 5 modelos               │
└────────────────────────────────────────────────┘
```

### Lógica de seleção

- Checkbox na marca sem expandir = marca inteira (modelos vazio = aplica a todos)
- Expandir marca e selecionar modelos individuais = regra com array de modelos
- Desmarcar todos modelos de uma marca = remove a regra daquela marca
- Busca filtra tanto marcas quanto modelos

## Arquivos modificados

- `src/components/admin/planos/MarcaModeloExclusionEditor.tsx` — Reescrever UI para lista colapsável multi-seleção
- `src/components/ui/searchable-select.tsx` — Corrigir `modal={true}` no Popover (fix geral)

