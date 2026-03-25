

# Criar perfil "Analista de Monitoramento" e permitir criação pela Equipe

## Resumo
Inserir o role `analista_monitoramento` no banco e expandir a tela de Equipe do monitoramento para que o coordenador possa criar analistas além de vistoriadores.

## Alterações

### 1. Dados no banco (INSERT via insert tool)
- Inserir `analista_monitoramento` em `app_roles_config` (area: Monitoramento, sigla: ANM, cor: teal, permissões: canManageInstalacoes, canManageRastreadores, canManageOuvidoria, canViewDashboard, is_operational: false)
- Atualizar `coordenador_monitoramento` para incluir `canCreateUser` nas permissions

### 2. `src/hooks/usePermissions.ts`
- Adicionar `isAnalistaMonitoramento` flag via `hasRoleByName('analista_monitoramento')`
- Adicionar ao `PermissionKey` type

### 3. `src/hooks/useEquipe.ts`
- Expandir query em `useProfissionaisEquipe` para buscar roles `instalador_vistoriador` **ou** `analista_monitoramento`
- Expandir tipo de `tipoVistoriador` em `useSaveProfissional` para `'instalador_vistoriador' | 'analista_monitoramento'`
- Quando tipo = `analista_monitoramento`, enviar `tipo: 'funcionario'` em vez de `prestador`

### 4. `src/components/monitoramento/ProfissionalModal.tsx`
- Alterar schema: `tipoVistoriador` de `z.literal(...)` para `z.enum(['instalador_vistoriador', 'analista_monitoramento'])`
- Adicionar Select "Tipo de Profissional" no formulário (Vistoriador/Instalador vs Analista de Monitoramento)
- Quando tipo = `analista_monitoramento`: ocultar campos de regiões e capacidade diária (não aplicáveis)

### 5. `src/pages/monitoramento/Equipe.tsx`
- Atualizar subtítulo/placeholder para incluir referência a analistas

### Sem alteração necessária
- **Perfis.tsx** (configurações): o novo role aparece automaticamente via `useAppRoles`
- **ProtectedRoute / PermissionGate**: sem mudanças, usam sistema dinâmico

## Arquivos editados
1. `src/hooks/usePermissions.ts` — novo flag + PermissionKey
2. `src/hooks/useEquipe.ts` — query expandida + tipo dinâmico
3. `src/components/monitoramento/ProfissionalModal.tsx` — seletor de tipo + campos condicionais
4. `src/pages/monitoramento/Equipe.tsx` — textos atualizados
5. Banco: 1 INSERT + 1 UPDATE em `app_roles_config`

