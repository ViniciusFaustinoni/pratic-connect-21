

# Plano: Continuar refatoração — Perfis.tsx, GerenciarRolesTab.tsx, auth.ts

## Resumo

Três arquivos restantes para eliminar hardcode de roles. Já temos `useAppRoles` e `src/config/modules.ts` criados.

## Alterações

### 1. Perfis.tsx — Remover hardcode de `perfis[]`, `modulos[]`, `MODULE_ITEMS`, `areaConfig`, `areas`

- Remover arrays locais `modulos` (linhas 28-47), `MODULE_ITEMS` (linhas 50-175), `perfis` (linhas 178-199), `areaConfig` (linhas 201-210), `areas` (linha 212)
- Importar `MODULES`, `MODULE_ITEMS` de `@/config/modules`
- Usar `useAppRoles()` para carregar perfis dinamicamente do banco
- Converter `AppRoleConfig` para `Perfil` (interface do PerfilCard) mapeando `color` string → classe CSS `bg-{color}-500`
- Gerar `areaConfig` e `areas` dinamicamente a partir dos roles carregados (cores/ícones mapeados por área)
- Manter toda lógica de matriz de visibilidade intacta (apenas troca a fonte dos dados)

### 2. GerenciarRolesTab.tsx — Eliminar `perfilDescricoes`, `areaIcons`, `areaBorderColors` hardcoded

- Remover interface local `Perfil` e props `perfis`
- Usar `useAppRoles()` diretamente para carregar roles, agrupar por área, e obter descrições/cores
- Props simplificadas (componente busca seus dados sozinho)

### 3. auth.ts — Simplificar `PerfilAcesso` e remover `PERFIL_ACESSO_LABELS`

- Mudar `PerfilAcesso` de union type hardcoded para `string` (dinâmico)
- Remover `PERFIL_ACESSO_LABELS` (substituído por `useAppRoles().getRoleLabel()`)
- Manter `AuthFlags` e `computeAuthFlags` por compatibilidade (flags como `isDiretor` continuam funcionando via `perfis.includes()`)
- Adicionar método genérico `hasRole(role: string)` no `computeAuthFlags`

### 4. Consumidores de `PERFIL_ACESSO_LABELS` (4 arquivos)

Atualizar para usar `useAppRoles().getRoleLabel(role)`:
- `src/components/usuarios/NovoFuncionarioModal.tsx`
- `src/components/usuarios/GerenciarPerfisModal.tsx`
- `src/pages/diretoria/Usuarios.tsx`
- `src/pages/diretoria/UsuarioDetalhe.tsx`

### 5. Ajustar `PerfilCard.tsx` e `AreaSection.tsx`

- Nenhuma mudança estrutural necessária — a interface `Perfil` já é compatível
- Apenas garantir que a prop `color` aceite formato dinâmico (`bg-purple-500` gerado pelo hook)

## Ordem de execução

1. auth.ts (simplificar tipo + remover labels)
2. Perfis.tsx (usar hook + config centralizada)
3. GerenciarRolesTab.tsx (usar hook)
4. Consumidores de PERFIL_ACESSO_LABELS (4 arquivos)

