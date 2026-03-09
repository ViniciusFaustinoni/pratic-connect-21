

# Plano: Eliminar Hardcode de Roles/Perfis — Tornar Dinâmico

## Problema Identificado

O sistema tem **listas de roles/perfis duplicadas e hardcoded em pelo menos 8 arquivos diferentes**, todas dessincronizadas entre si. Quando um novo role é adicionado no banco (enum `app_role`), é preciso atualizar manualmente:

| Arquivo | O que está hardcoded |
|---|---|
| `src/types/auth.ts` | `PerfilAcesso` type union, `PERFIL_ACESSO_LABELS`, `AuthFlags` |
| `src/pages/configuracoes/UsuariosAcessos.tsx` | `perfisConfig`, `tiposUsuario`, `rolesConfig`, `AppRole` type, `allRoles` |
| `src/pages/configuracoes/Usuarios.tsx` | `perfisConfig`, `tiposUsuario`, filtro de perfis no Select |
| `src/pages/configuracoes/Perfis.tsx` | `perfis[]` array (20 perfis), `areaConfig`, `MODULE_ITEMS` |
| `src/pages/configuracoes/UsuarioForm.tsx` | `perfisDisponiveis[]`, `MODULE_LABELS` |
| `src/hooks/usePermissions.ts` | `PermissionKey` type, todas as flags booleanas |
| `src/hooks/useRequireAuth.ts` | Hooks especializados com roles hardcoded |
| `src/contexts/AuthContext.tsx` | Flags booleanas derivadas |
| Edge Functions (`create-user`) | `allowedRoles` array |

Resultado: novos roles como `desenvolvedor`, `admin_master`, `vistoriador_base`, `regulador`, `analista_eventos`, `sindicante` existem no banco mas **não aparecem consistentemente na UI** (filtros, formulários, badges).

## Solução

### 1. Criar tabela `app_roles_config` no banco (fonte única de verdade)

Uma tabela que armazena a configuração visual e funcional de cada role:

```text
app_roles_config
├── role (PK, text) — ex: 'diretor'
├── label (text) — ex: 'Diretor'
├── description (text) — ex: 'Acesso total ao sistema'
├── area (text) — ex: 'Diretoria'
├── sigla (text) — ex: 'Dir'
├── color (text) — ex: 'purple'
├── icon_name (text) — ex: 'Crown'
├── sort_order (int) — para ordenação na UI
├── is_active (bool) — para desativar sem remover
└── created_at (timestamptz)
```

Populada com os ~20 roles atuais via seed. Quando um novo role for adicionado ao enum, basta inserir uma linha nesta tabela.

### 2. Criar hook `useAppRoles` (cache com React Query)

Hook centralizado que busca `app_roles_config` e expõe:
- `roles[]` — lista completa de roles ativos
- `getRoleLabel(role)` — label para exibição
- `getRoleColor(role)` — cor para badges
- `getRolesByArea()` — agrupados por área
- `roleOptions` — para Selects/filtros

Stale time de 30min (dados raramente mudam). Substituirá todos os `perfisConfig`, `rolesConfig`, `perfisDisponiveis` hardcoded.

### 3. Refatorar componentes para usar `useAppRoles`

**UsuariosAcessos.tsx**: Remover `perfisConfig`, `rolesConfig`, `AppRole` type local. Filtro de perfil no Select populado dinamicamente.

**Usuarios.tsx**: Idem — remover `perfisConfig`, Select de filtro dinâmico.

**UsuarioForm.tsx**: Remover `perfisDisponiveis`. Checkboxes de roles gerados a partir do hook.

**Perfis.tsx**: Remover array `perfis[]` hardcoded. Carregar do hook, agrupar por área dinamicamente.

### 4. Manter tipos TypeScript como `string` para roles dinâmicos

O type `PerfilAcesso` em `auth.ts` será simplificado para `string` (ou mantido como union para autocomplete mas com fallback). `PERFIL_ACESSO_LABELS` será removido em favor do hook.

As flags booleanas no `AuthContext` (`isDiretor`, `isGerente`, etc.) serão mantidas por compatibilidade mas marcadas como deprecated. O pattern recomendado passa a ser `hasRole('diretor')`.

### 5. Módulos (`modulos[]` e `MODULE_ITEMS`)

Estes já estão na tabela `user_module_visibility`. Porém a lista de módulos em si (labels, sub-itens) também está hardcoded. Opcionalmente, criar tabela `app_modules_config` no futuro. Por ora, centralizar em um único arquivo `src/config/modules.ts` para evitar duplicação entre `Perfis.tsx`, `UsuarioForm.tsx` e `useModuleVisibility.ts`.

### Arquivos afetados

- **Novo**: Migration SQL para `app_roles_config` + seed data
- **Novo**: `src/hooks/useAppRoles.ts`
- **Novo**: `src/config/modules.ts` (centralizar MODULE_ITEMS + MODULE_LABELS)
- **Editar**: `src/pages/configuracoes/UsuariosAcessos.tsx` — remover hardcode, usar hook
- **Editar**: `src/pages/configuracoes/Usuarios.tsx` — remover hardcode, usar hook
- **Editar**: `src/pages/configuracoes/UsuarioForm.tsx` — remover `perfisDisponiveis`, usar hook
- **Editar**: `src/pages/configuracoes/Perfis.tsx` — remover `perfis[]`, usar hook
- **Editar**: `src/types/auth.ts` — simplificar `PerfilAcesso`, remover `PERFIL_ACESSO_LABELS`
- **Editar**: `src/components/configuracoes/GerenciarRolesTab.tsx` — usar hook

### Ordem de execução

1. Migration + seed (criar tabela e popular)
2. Criar `useAppRoles` hook + `modules.ts`
3. Refatorar `UsuarioForm.tsx` (mais isolado)
4. Refatorar `Usuarios.tsx`
5. Refatorar `UsuariosAcessos.tsx`
6. Refatorar `Perfis.tsx`
7. Limpar types em `auth.ts`

