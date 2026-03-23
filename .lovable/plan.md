

# Plano: Classificação e Filtro por Tipo de Beneficiário

## Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/hooks/useDashboardVendaExterna.ts` | Buscar roles dos vendedores e adicionar campo `tipo` ao `VendedorResumo` |
| `src/pages/financeiro/DashboardVendaExterna.tsx` | Coluna "Tipo" com badge colorido + Select de filtro |

## Detalhamento

### 1. Hook — buscar roles e mapear tipo

No `useDashboardVendaExterna.ts`, dentro da `vendedoresQuery`:

- Após obter os `vendedorIds`, buscar roles na tabela `user_roles` via join com `profiles`:
  ```
  profiles.id → profiles.user_id → user_roles.user_id
  ```
  Como `vendedor_id` é `profiles.id`, primeiro buscar `user_id` dos profiles e depois os roles.

- Mapear role para tipo de exibição:
  - `vendedor_externo` → `"Vendedor"`
  - `agencia` → `"Agência"`
  - `supervisor_vendas` → `"Supervisor"`
  - Qualquer outro → `"Outro"`

- Adicionar `tipo: string` ao interface `VendedorResumo`

### 2. Dashboard — coluna "Tipo"

Na tabela, adicionar `<TableHead>Tipo</TableHead>` após "Vendedor" (e atualizar `colSpan` de 7 para 8).

Na row, renderizar badge colorido:
- `"Vendedor"` → `bg-blue-100 text-blue-700 border-blue-200`
- `"Agência"` → `bg-purple-100 text-purple-700 border-purple-200`
- `"Supervisor"` → `bg-orange-100 text-orange-700 border-orange-200`
- `"Outro"` → `bg-gray-100 text-gray-700 border-gray-200`

### 3. Dashboard — filtro por tipo

Adicionar estado `filtroTipo` com type `'todos' | 'Vendedor' | 'Agência' | 'Supervisor'`.

Adicionar um terceiro `Select` na barra de filtros, após o Select de situação:
```
Tipo de beneficiário: [Todos | Vendedor | Agência | Supervisor]
```

Integrar no `filtrados` filter chain:
```ts
if (filtroTipo !== 'todos' && v.tipo !== filtroTipo) return false;
```

