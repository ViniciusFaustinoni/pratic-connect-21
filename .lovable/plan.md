

# Investigacao Profunda: Hardcode Restante em Usuarios e Perfis de Acesso

## Estado atual

A refatoracao anterior adicionou `permissions` JSONB em `app_roles_config` e migrou os `canXxx` de `usePermissions` para `hasPerm()`. Porem, **os identity flags e exclusivity flags continuam 100% hardcoded**, e diversos arquivos fazem verificacoes de role por string literal fora do hook centralizado.

---

## Focos de hardcode identificados

### Foco 1 — `src/types/database.ts`: `AppRole` union + `ROLE_LABELS` (CRITICO)

- **L10-23**: Union type `AppRole` com 13 roles fixos. Roles como `regulador`, `sindicante`, `analista_eventos`, `desenvolvedor`, `admin_master`, `supervisor_comercial` NAO existem neste tipo.
- **L597-611**: `ROLE_LABELS` com 13 labels hardcoded.
- **Consumidores**: `AppHeader.tsx` (L65, L83), `Perfil.tsx` (L278, L482), `Consultores.tsx` e `ConsultorEditSheet.tsx` (duplicatas locais).
- O `useAppRoles().getRoleLabel()` ja existe e cobre todos os roles do banco.

### Foco 2 — `src/types/auth.ts`: `AuthFlags` + `computeAuthFlags()` (CRITICO)

- **L115-137**: Interface `AuthFlags` com 14 identity flags hardcoded por role name (`isDiretor`, `isGerente`, `isSupervisor`, etc.)
- **L153-174**: `initialAuthFlags` com 14 defaults
- **L180-206**: `computeAuthFlags()` com 14 `perfis.includes()` fixos
- Novos roles (ex: `supervisor_comercial`) nao ganham flags automaticas.

### Foco 3 — `src/hooks/usePermissions.ts`: Identity + Exclusivity flags (CRITICO)

- **L95-106**: 9 identity flags por `hasRole('nome_fixo')` ou `hasRoleByName('nome_fixo')`
- **L114-150**: 8 exclusivity flags (`isXxxOnly`) com exclusao manual de ~8 roles cada. Quando um novo role e adicionado, TODOS os blocos `Only` precisam ser atualizados para excluir o novo role.
- **L148-150**: `isPerfilLimitado` e uma OR de 8 flags fixas
- **L155-157**: Cotacao permissions com 3 variaveis hardcoded (`isVendedorCotacao`, `isAnalistaCotacao`, `isGestorCotacao`)

### Foco 4 — `src/contexts/AuthContext.tsx`: Funcoes legadas (MEDIO)

- **L490-493**: `canAccess` hardcoda `diretor` como bypass total
- **L500-508**: `getRedirectUrl` hardcoda `instalador_vistoriador` → `/instalador`
- **L530-548**: 5 funcoes legadas (`isGerenciaFn`, `isVendedorFn`, `isInstaladorFn`) com roles fixos

### Foco 5 — `src/pages/diretoria/PerfisAcesso.tsx`: Pagina inteira duplicada (CRITICO)

- **L31-44**: Redefine `AppRole` localmente (13 roles)
- **L53-132**: `rolesConfig` com 13 configs hardcoded (label, desc, icon, color)
- Deveria usar `useAppRoles()` como `Perfis.tsx` ja faz.

### Foco 6 — `src/hooks/useDocumentoPermissoes.ts`: Mapeamento fixo (MEDIO)

- **L89-101**: `mapearPerfilParaDocumentos()` com 10 `roles.includes()` fixos
- **L14-86**: `PERMISSOES_POR_PERFIL` com 7 perfis hardcoded
- Deveria derivar permissoes de documentos do `app_roles_config.permissions` (ex: `canCreateTemplate`, `canEditTemplate`, etc.)

### Foco 7 — `src/pages/vendas/CotacaoDetalhe.tsx`: Check inline (BAIXO)

- **L57**: `const isDiretor = roles?.includes('diretor')` — deveria usar `usePermissions().isDiretor` ou melhor, `cotacao.canDelete`

### Foco 8 — `src/pages/auth/AuthCallback.tsx`: Redirect hardcoded (MEDIO)

- **L106**: `roles.includes('sindicante')` → redirect `/sindicante`
- **L109**: Fallback → `/instalador`
- Deveria usar `getRedirectUrl()` do AuthContext

### Foco 9 — `PermissionGate` com identity flags (MEDIO)

11 arquivos usam `PermissionGate` com identity flags como `isDiretor`, `isGerente`:
- `ComissoesConfig.tsx`: `permission={['isDiretor', 'isGerente']}`
- `Comissoes.tsx`: `permission={['isDiretor', 'isGerente', 'isSupervisor']}`
- `ComissoesFechamentoTab.tsx`: 5 ocorrencias de `['isDiretor', 'isGerente']`
- `Leads.tsx`: `hasPermission('isDiretor')`
- Deveria usar capability permissions (ex: `canManageComissoes`, `canApproveComissoes`)

### Foco 10 — Edge Functions com roles fixos (MEDIO)

14 edge functions verificam roles por string:

| Funcao | Roles fixos |
|---|---|
| `create-user` | `['diretor', 'gerente_comercial', 'supervisor_vendas', 'analista_eventos']` |
| `import-users` | `['diretor', 'gerente_comercial', 'supervisor_vendas']` |
| `delete-ativacao` | `['diretor', 'admin_master', 'desenvolvedor']` |
| `delete-cotacao` | `.eq('role', 'diretor')` |
| `delete-associado` | `role === 'diretor'` |
| `delete-sinistro` | `role === 'diretor'` |
| `admin-reset-password` | `role === 'diretor'` ou `admin_master` |
| `integracoes-credenciais` | `['diretor', 'desenvolvedor', 'admin_master']` |
| `gerar-link-evento` | `['regulador', 'analista_sinistro', 'diretor', ...]` |
| `criar-sinistro` | `.eq('role', 'analista_sinistros')` fallback `diretor` |
| `whatsapp-webhook` | `.eq('role', 'diretor')` |
| `cron-verificar-sindicancias` | `.eq('role', 'diretor')` |
| `analisar-exclusividade` | `.in('role', ['diretor', 'gerente_comercial'])` |
| `acionar-roubo-furto` | `.in('role', ['diretor', 'analista_sinistros', ...])` |

### Foco 11 — Queries com roles fixos no frontend (MEDIO)

| Arquivo | Roles fixos na query |
|---|---|
| `useConsultores.ts` L18 | `ROLES_COMERCIAIS = ['vendedor_clt', 'vendedor_externo', 'supervisor_vendas', 'gerente_comercial']` |
| `useVendedores.ts` L19 | `.in('role', ['vendedor_clt', 'vendedor_externo', ...])` |
| `useRotas.ts` L284, L569 | `.eq('role', 'instalador_vistoriador')` (2x) |
| `PlantoesCalendario.tsx` L48 | `.eq('role', 'instalador_vistoriador')` |
| `EscalaDiaPanel.tsx` L50 | `.eq('role', 'instalador_vistoriador')` |
| `AgendarVistoriaModal.tsx` L138 | `.eq('role', 'instalador_vistoriador')` |
| `NovoSinistroModal.tsx` L586 | `.eq('role', 'analista_eventos')` fallback `diretor` |
| `UsuariosAcessos.tsx` L382 | `['vendedor_clt', 'vendedor_externo'].includes(role)` |
| `Usuarios.tsx` L269 | `['vendedor_clt', 'vendedor_externo'].includes(role)` |

### Foco 12 — `useRouteGuard.ts`: Redirecionamentos hardcoded (MEDIO)

- L26-27: `isReguladorOnly` → `/regulador`
- L34-35: `isInstaladorVistoriadorOnly` → `/instalador`
- L45: `isSindicanteOnly` → `/sindicante`
- Depende das exclusivity flags que sao hardcoded (Foco 3)

---

## Resumo quantitativo

| Categoria | Arquivos | Ocorrencias |
|---|---|---|
| Identity flags (`isDiretor`, `isVendedor`, etc.) consumidas | 71 | ~1100 |
| `ROLE_LABELS` / `AppRole` union type | 19 | ~319 |
| `.includes('role_fixo')` direto | 5 | ~37 |
| Edge functions com roles fixos | 14 | ~25 |
| Queries frontend com `.eq('role', ...)` | 9 | ~15 |
| `PermissionGate` com identity flags | 6 | ~15 |
| Exclusivity flags (`isXxxOnly`) com exclusao manual | 1 | 8 blocos |

---

## Plano de correcao (priorizado)

### Fase 1 — Remover `AppRole` union e `ROLE_LABELS` de `database.ts`
Migrar 6 consumidores para `useAppRoles().getRoleLabel()`. Manter apenas `type AppRole = string` para compatibilidade de tipo.

### Fase 2 — Simplificar `AuthFlags` e `computeAuthFlags`
Remover as 14 flags por role name. Manter apenas: `isAuthenticated`, `isFuncionario`, `isAssociado`, `isPrestador`, `isAtivo`, `isBloqueado`, `hasRole()`. Os ~71 consumidores de flags devem migrar para `usePermissions()`.

### Fase 3 — Refatorar exclusivity flags em `usePermissions`
Adicionar campo `is_operational` e `redirect_path` em `app_roles_config`. O calculo `isXxxOnly` passa a ser: "usuario so tem roles operacionais (sem privilegiado)" — derivado do banco em vez de exclusao manual.

### Fase 4 — Adicionar capability permissions faltantes ao banco
Adicionar `canManageComissoes`, `canApproveComissoes`, `canDeleteCotacao`, `canDeleteAssociado`, `canDeleteSinistro`, `canCreateTemplate`, `canEditTemplate`, `canDeleteTemplate` em `app_roles_config.permissions`. Migrar `PermissionGate` e `useDocumentoPermissoes` para usar `hasPerm()`.

### Fase 5 — Criar funcao SQL `has_permission(user_id, permission_key)`
Usada pelas edge functions para verificar permissoes dinamicamente em vez de listar roles.

### Fase 6 — Migrar edge functions
Substituir `allowedRoles.includes(role)` por chamada a `has_permission()`.

### Fase 7 — Migrar queries com roles fixos
Para queries que buscam "quem sao os instaladores", usar `app_roles_config.area = 'Monitoramento'` ou novo campo `is_field_worker`. Para "quem sao os vendedores", usar `area = 'Comercial'`.

### Fase 8 — Limpar `AuthContext.tsx` e `AuthCallback.tsx`
Remover funcoes legadas. Usar `redirect_path` do banco para `getRedirectUrl()`.

### Fase 9 — Refatorar `PerfisAcesso.tsx`
Usar `useAppRoles()` como `Perfis.tsx` ja faz.

---

## Dados a adicionar no banco

| Coluna/Tabela | Descricao |
|---|---|
| `app_roles_config.is_operational` | Boolean — role e operacional (instalador, regulador, sindicante) |
| `app_roles_config.redirect_path` | String — path de redirect pos-login (ex: `/instalador`, `/sindicante`) |
| `app_roles_config.permissions` (novos valores) | `canManageComissoes`, `canApproveComissoes`, `canDeleteCotacao`, `canDeleteAssociado`, `canDeleteSinistro`, `canCreateTemplate`, `canEditTemplate`, `canDeleteTemplate` |

## Arquivos afetados (total)

~90 arquivos entre frontend e edge functions. A migracao deve ser feita em fases para minimizar risco.

