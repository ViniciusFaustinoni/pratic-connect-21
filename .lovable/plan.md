
# Controle de Visibilidade de Abas e Menus por Perfil — IMPLEMENTADO ✅

## O que mudou

1. **Nova tabela `role_module_item_visibility`** — controla visibilidade no nível de sub-item (abas dentro de cada módulo)
2. **Coluna `can_edit`** adicionada em `role_module_visibility` — permite definir acesso somente leitura
3. **`canManagePermissions`** restrito a `isDiretor` e `isDesenvolvedor` (Admin Master removido)
4. **Hook `useModuleItemVisibility`** criado — calcula união dos sub-itens visíveis do usuário
5. **Hook `useModuleVisibility`** expandido — agora retorna `editableModules`
6. **AppSidebar** filtrado — sub-itens do menu são filtrados pelo hook de item visibility
7. **Página Perfis** expandida — módulos expandíveis com sub-itens, coluna "Pode Editar"
