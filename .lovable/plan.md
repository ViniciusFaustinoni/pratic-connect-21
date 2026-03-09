

# Investigacao: Hardcode na area de Usuarios e Perfis de Acesso

## Focos de hardcode encontrados

### Foco 1 — `src/types/auth.ts`: `PERFIL_ACESSO_LABELS` e `AuthFlags` (CRITICO)

**Linhas 95-112**: Mapa `PERFIL_ACESSO_LABELS` com 16 roles hardcoded. Ja marcado como `@deprecated` mas ainda exportado.

**Linhas 132-154**: Interface `AuthFlags` com 14 flags booleanas hardcoded por role (`isDiretor`, `isGerente`, `isSupervisor`, `isVendedor`, `isAnalistaCadastro`, etc.). Se um novo role for adicionado em `app_roles_config`, nao aparece automaticamente.

**Linhas 197-223**: `computeAuthFlags()` com 14 `perfis.includes('...')` hardcoded. Mesma limitacao.

**Problema**: Novos roles adicionados no banco nao ganham flags automaticas. Porem o `hasRole()` dinamico ja existe e funciona para qualquer role.

### Foco 2 — `src/hooks/usePermissions.ts`: Roles hardcoded por nome (CRITICO)

Todo o hook (334 linhas) referencia roles por string literal:
- L4-6: `PERFIS_VENDEDOR`, `PERFIS_CADASTRO`, `PERFIS_GESTOR` — arrays fixos
- L100-204: 10 blocos de `isXxxOnly` com listas de exclusao manual de ~10 roles cada
- L210-212: `isVendedorCotacao`, `isAnalistaCotacao`, `isGestorCotacao` — hardcoded
- L296-324: 25+ permissoes (`canManageUsers`, `canManageLeads`, etc.) com combinacoes OR de roles fixos

**Problema**: Quando um novo role e adicionado (ex: `supervisor_comercial`), e preciso editar manualmente este arquivo para ele ganhar permissoes. Deveria ser derivado de metadados no banco.

### Foco 3 — `src/hooks/useRequireAuth.ts`: Hooks com roles fixos (MEDIO)

7 hooks especializados com listas de `allowedPerfis` hardcoded:
- `useRequireAdmin`: `['diretor', 'gerente_comercial']`
- `useRequireVendas`: 5 roles fixos
- `useRequireCadastro`: 3 roles fixos
- `useRequireMonitoramento`: 4 roles fixos
- `useRequireFinanceiro`: 2 roles fixos
- `useRequireJuridico`: 2 roles fixos

**Problema**: Novas roles nao herdam acesso automaticamente. Deveria buscar permissoes do banco.

### Foco 4 — `src/config/modules.ts`: MODULES e MODULE_ITEMS hardcoded (MEDIO)

- 18 modulos e ~80 sub-itens definidos estaticamente
- Usado pela matriz de visibilidade em `Perfis.tsx` e `UsuarioForm.tsx`
- Se um modulo for adicionado no sidebar, precisa atualizar este arquivo manualmente

**Problema**: A lista de modulos deveria ser fonte unica. Nao e critico porque modulos raramente mudam, mas e uma duplicacao com o sidebar.

### Foco 5 — `src/pages/configuracoes/Perfis.tsx`: AREA_ICON_MAP e AREA_STYLE_MAP (BAIXO)

- L30-51: Mapas de icone e estilo por area com 8 areas hardcoded
- Ja usa fallback (`Shield` e `DEFAULT_AREA_STYLE`), entao novas areas funcionam — apenas sem icone/cor especifica

### Foco 6 — `src/types/monitoramento.ts`: REGIOES_ATENDIMENTO (MEDIO)

- L315-326: 10 regioes hardcoded usadas em `UsuarioForm.tsx`, `EquipeFilters.tsx`, `FilaVistorias.tsx`
- Deveria vir do banco (tabela `regioes` ja existe com outra finalidade, ou nova tabela `regioes_atendimento`)

### Foco 7 — `src/pages/configuracoes/Logs.tsx`: acoesConfig (BAIXO)

- L14-26: 9 tipos de acao de log com labels, icones e cores hardcoded
- Funcional mas nao extensivel dinamicamente

### Foco 8 — Verificacoes de role por string literal espalhadas (65 arquivos)

`isDiretor`, `isGerente`, `isVendedor` etc. sao usados em 65 arquivos. Esses consomem de `usePermissions()` que ja centraliza, entao o problema real esta no Foco 2.

---

## Plano de correcao

### Fase 1 — Tornar permissoes dinamicas via banco

**O que fazer**: Criar tabela `role_permissions` no banco com colunas `role`, `permission_key`, `granted`. O `usePermissions` passaria a consultar essa tabela para resolver `canManageUsers`, `canManageLeads`, etc.

Alternativa mais simples (recomendada): Adicionar coluna `permissions` (JSONB) na tabela `app_roles_config` existente, contendo as chaves de permissao de cada role. O `usePermissions` leria de `useAppRoles()` e derivaria as permissoes por uniao dos roles do usuario.

### Fase 2 — Limpar `auth.ts`

- Remover `PERFIL_ACESSO_LABELS` (ja tem `useAppRoles().roleLabelsMap`)
- Remover flags individuais de `AuthFlags` (`isDiretor`, `isGerente`, etc.) — manter apenas `hasRole()`
- Atualizar `computeAuthFlags` para nao listar roles fixos
- Atualizar 65 arquivos consumidores para usar `hasRole()` ou `usePermissions()`

### Fase 3 — Limpar `useRequireAuth.ts`

- Remover hooks especializados (`useRequireAdmin`, `useRequireVendas`, etc.) ou refatora-los para buscar roles permitidos da tabela `role_permissions`/`app_roles_config`

### Fase 4 — REGIOES_ATENDIMENTO dinamicas

- Inserir regioes como chave JSON em `configuracoes` ou tabela propria
- Criar hook `useRegioesAtendimento()`
- Atualizar 4 consumidores

### Fase 5 — AREA_ICON_MAP / AREA_STYLE_MAP

- Adicionar colunas `icon_area` e `color_area` em `app_roles_config` ou tabela `areas_config`
- Atualizar `Perfis.tsx` para derivar icones/cores do banco

---

## Dados a adicionar no banco

| Tabela/Coluna | Descricao |
|---|---|
| `app_roles_config.permissions` (JSONB) | Array de permission keys por role |
| `configuracoes.regioes_atendimento` | JSON com regioes de atendimento |
| `app_roles_config.area_icon` | Icone da area (opcional) |
| `app_roles_config.area_color` | Cor/gradiente da area (opcional) |

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| `src/types/auth.ts` | Remover `PERFIL_ACESSO_LABELS`, simplificar `AuthFlags` |
| `src/hooks/usePermissions.ts` | Derivar permissoes do banco via `app_roles_config.permissions` |
| `src/hooks/useRequireAuth.ts` | Remover/refatorar hooks especializados |
| `src/hooks/useAppRoles.ts` | Adicionar `getPermissionsForRoles()` |
| `src/config/modules.ts` | Manter (modulos sao estáveis) |
| `src/types/monitoramento.ts` | Remover `REGIOES_ATENDIMENTO` |
| `src/pages/configuracoes/Perfis.tsx` | Derivar icones/cores de area do banco |
| `src/pages/configuracoes/UsuarioForm.tsx` | Usar `useRegioesAtendimento()` |
| `src/contexts/AuthContext.tsx` | Simplificar flags |
| 65 arquivos com `isDiretor`/`isGerente`/etc. | Migrar para `hasRole()` ou `usePermissions()` |

## Ordem de execucao

1. Migration: adicionar coluna `permissions` JSONB em `app_roles_config` com dados iniciais
2. Migration: inserir `regioes_atendimento` em `configuracoes`
3. Atualizar `useAppRoles` para expor permissoes
4. Refatorar `usePermissions` para derivar do banco
5. Limpar `auth.ts` (remover deprecated)
6. Refatorar `useRequireAuth` hooks
7. Criar `useRegioesAtendimento` e atualizar consumidores
8. Atualizar `Perfis.tsx` para icones/cores dinamicos

