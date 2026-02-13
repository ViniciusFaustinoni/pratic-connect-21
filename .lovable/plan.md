
# Nova Area: Auto Centers (submenu Oficinas)

## Resumo
Criar um CRUD completo de Auto Centers como subitem do menu Oficinas, com gerenciamento de pecas vinculadas a cada auto center.

## Estrutura do Banco de Dados

Duas novas tabelas:

**`auto_centers`**
- `id` (uuid, PK)
- `nome` (text, obrigatorio)
- `endereco` (text)
- `cidade` (text)
- `estado` (text, 2 chars)
- `cep` (text)
- `tipo` (text: 'auto_center' | 'ferro_velho')
- `contato_nome` (text)
- `contato_telefone` (text)
- `contato_email` (text)
- `observacoes` (text)
- `created_at`, `updated_at` (timestamptz)

**`auto_center_pecas`**
- `id` (uuid, PK)
- `auto_center_id` (uuid, FK -> auto_centers)
- `nome` (text, obrigatorio)
- `valor` (numeric)
- `condicao` (text: 'novo' | 'usado')
- `created_at` (timestamptz)

RLS habilitado com politica de acesso para usuarios autenticados.

## Arquivos a Criar

1. **`src/pages/oficinas/AutoCenters.tsx`** - Pagina de listagem com busca, filtro por tipo, cards dos auto centers. Ao clicar em um card, abre o drawer de detalhes.

2. **`src/hooks/useAutoCenters.ts`** - Hooks para CRUD: `useAutoCenters` (listagem com filtros), `useCreateAutoCenter`, `useUpdateAutoCenter`, `useDeleteAutoCenter`, `useAutoCenterPecas`, `useCreatePeca`, `useDeletePeca`.

3. **`src/components/oficinas/AutoCenterFormDialog.tsx`** - Dialog com formulario para criar/editar auto center (nome, endereco, tipo, contato).

4. **`src/components/oficinas/AutoCenterDetailDrawer.tsx`** - Sheet lateral mostrando detalhes do auto center + listagem de pecas com botao de adicionar/remover pecas.

5. **`src/components/oficinas/AutoCenterPecaFormDialog.tsx`** - Dialog para adicionar peca (nome, valor, condicao novo/usado).

## Arquivos a Modificar

1. **`src/components/layout/AppSidebar.tsx`** - Adicionar item "Auto Centers" no grupo Oficinas com icone `Store`.

2. **`src/App.tsx`** - Adicionar rota `/oficinas/auto-centers`.

## Detalhes Tecnicos

- Segue os mesmos padroes de `Oficinas.tsx` + `OficinaFormDialog` + `OficinaDetailDrawer`
- Usa react-hook-form + zod para validacao
- Usa tanstack-query para cache e mutations
- Toast de sucesso/erro via sonner
- Componentes shadcn/ui existentes (Dialog, Sheet, Card, Badge, etc.)
