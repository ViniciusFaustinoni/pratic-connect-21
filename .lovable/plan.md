

# Plano: Mover "Rotas" do Monitoramento para a Diretoria

## Situação Atual

- O item "Rotas" está no menu **Monitoramento** em `AppSidebar.tsx` (linha 202), com permissão `canEditRotas`.
- A rota `/monitoramento/rotas` renderiza o componente `Rotas`.
- Também existe `/monitoramento/gestao-rotas` que renderiza `GestaoRotas`.
- O módulo Diretoria já tem permissão `isDiretorOnly` (linha 391).

## Alterações

### 1. `AppSidebar.tsx`
- **Remover** o item `Rotas` da seção Monitoramento (linha 202).
- **Adicionar** o item `Rotas` na seção Diretoria (após "Relatórios", linha 404):
  ```
  { title: 'Rotas', url: '/diretoria/rotas', icon: Route }
  ```
  Não precisa de permissão extra — a seção Diretoria já é restrita a `isDiretorOnly`.

### 2. `App.tsx`
- Alterar a rota `/monitoramento/rotas` para `/diretoria/rotas` (mesmo componente `Rotas`).
- Alterar `/monitoramento/gestao-rotas` para `/diretoria/gestao-rotas` (mesmo componente `GestaoRotas`).
- Adicionar redirect de `/monitoramento/rotas` → `/diretoria/rotas` para não quebrar links existentes.

### 3. Componentes internos de Rotas
- Verificar se `Rotas.tsx` ou `GestaoRotas.tsx` têm links internos para `/monitoramento/rotas` ou `/monitoramento/gestao-rotas` e atualizar para `/diretoria/`.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Mover item de menu |
| `src/App.tsx` | Mover rotas + redirect |
| `src/pages/monitoramento/Rotas.tsx` | Atualizar links internos se houver |
| `src/pages/monitoramento/GestaoRotas.tsx` | Atualizar links internos se houver |

