

# Migrar Matriz de Visibilidade de "por perfil" para "por usuario"

## Contexto

Atualmente, a visibilidade de modulos e sub-itens e configurada **por perfil** (role) nas tabelas `role_module_visibility` e `role_module_item_visibility`. Quando um usuario tem multiplos perfis, o sistema calcula a uniao. O usuario quer que a configuracao seja **por usuario individual**.

## Plano

### 1. Criar tabelas de visibilidade por usuario

Criar duas novas tabelas no banco:

```text
user_module_visibility
- id (uuid, PK)
- user_id (uuid, FK profiles.id)
- module_id (text)
- visible (boolean)
- can_edit (boolean)
- created_at, updated_at
- UNIQUE(user_id, module_id)

user_module_item_visibility
- id (uuid, PK)
- user_id (uuid, FK profiles.id)
- module_id (text)
- item_id (text)
- visible (boolean)
- created_at, updated_at
- UNIQUE(user_id, module_id, item_id)
```

Ambas com RLS habilitado e politicas para diretores/desenvolvedores gerenciarem.

### 2. Adaptar a Matriz de Visibilidade (Perfis.tsx)

Alterar a aba "Visibilidade" para operar por usuario:

- Trocar o eixo horizontal de "perfis" para **usuarios** (lista de profiles)
- Adicionar filtro/busca de usuarios por nome
- As queries passam a ler/gravar em `user_module_visibility` e `user_module_item_visibility`
- Manter a mesma UI de toggles (Switch) e sub-itens expandiveis
- Manter a logica de can_edit por modulo

### 3. Adaptar useModuleVisibility.ts

Alterar o hook para consultar `user_module_visibility` usando `user.id` diretamente, em vez de buscar por roles na tabela antiga.

Logica:
- Buscar registros de `user_module_visibility` onde `user_id = auth.uid()` e `visible = true`
- Calcular `editableModules` da mesma forma (onde `can_edit = true`)
- Se nao houver registros para o usuario, retornar vazio (sem acesso)

### 4. Adaptar useModuleItemVisibility.ts

Mesma logica: consultar `user_module_item_visibility` por `user_id` em vez de `role`.

### 5. Adaptar ModuleAccessCard no UsuarioForm.tsx

O card "Acesso a Modulos" na edicao de usuario passa a:
- Consultar `user_module_visibility` pelo `user_id` do usuario sendo editado
- Tornar-se **editavel** (nao mais somente leitura) com toggles para cada modulo
- Permitir salvar diretamente as permissoes do usuario

### 6. Remover dependencia das tabelas role_module_visibility

As tabelas `role_module_visibility` e `role_module_item_visibility` deixam de ser usadas no runtime. Podem ser mantidas como referencia ou removidas posteriormente.

## Resumo de arquivos

| Arquivo | Alteracao |
|---|---|
| **Migracao SQL** | Criar tabelas `user_module_visibility` e `user_module_item_visibility` com RLS |
| `src/pages/configuracoes/Perfis.tsx` | Reescrever matriz para eixo de usuarios em vez de perfis |
| `src/hooks/useModuleVisibility.ts` | Consultar `user_module_visibility` por `user_id` |
| `src/hooks/useModuleItemVisibility.ts` | Consultar `user_module_item_visibility` por `user_id` |
| `src/pages/configuracoes/UsuarioForm.tsx` | Card editavel com toggles por modulo, gravando em `user_module_visibility` |
| `src/hooks/useRouteGuard.ts` | Nenhuma alteracao (ja usa `visibleModules` do hook) |

## Resultado esperado

- A matriz de visibilidade mostra **usuarios** nas colunas (com busca/filtro)
- Cada usuario tem sua propria configuracao de modulos visiveis e editaveis
- O formulario de edicao de usuario permite configurar diretamente os acessos
- O route guard continua funcionando sem alteracoes (consome o mesmo hook)

