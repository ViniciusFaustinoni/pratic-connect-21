## Problema observado

ALESSANDRA PAULA KLEIZ não enxerga módulos liberados depois que o usuário dela foi criado. No screenshot vejo que ela tem só o perfil **Analista de Cadastro** e, no card "Acesso a Módulos", os toggles extras estão desligados. Os módulos marcados como "Já incluso no perfil" (Dashboard, Cadastro, Eventos/Sinistros, Oficinas, Documentos) vêm das `permissions` do perfil dela em `app_roles_config`.

## Causa raiz — comprovada no código

Existem **três fontes** que alimentam o sidebar/guards. Só **uma** propaga em tempo real; as outras duas exigem reload manual:

### 1. Acesso a Módulos (toggle no card) — `user_module_visibility`
`src/hooks/useModuleVisibility.ts:27-66` — staleTime 30s, `refetchOnWindowFocus: true` e canal Realtime filtrado por `user_id`. Funciona, propaga em segundos. Sem problema.

### 2. Perfis de acesso atribuídos — `user_roles` (problema)
`src/contexts/AuthContext.tsx:130-149` define `fetchPerfis`, chamado **uma única vez** dentro de `loadUserData` (linhas 193-200). `setPerfis` só roda no login. Não há `useQuery`, não há subscription Realtime, não há refetch on focus. Se o admin adicionar "Analista de Eventos" agora, a sessão ativa da Alessandra só pega isso depois de logout/refresh do navegador.

### 3. Permissões do perfil — `app_roles_config.permissions` (problema)
`src/hooks/useAppRoles.ts:27-42`:
```ts
useQuery({
  queryKey: ['app-roles-config'],
  queryFn: ...,
  staleTime: 30 * 60 * 1000, // 30 min
});
```
Sem `refetchOnWindowFocus`, sem Realtime. `usePermissions` (`src/hooks/usePermissions.ts:107`) deriva `canManageSinistros`, `canManageOficinas` etc. via `getPermissionsForRoles(roles)` — que lê dessas permissões cacheadas por 30 min. `AppSidebar.tsx:606` filtra grupos com `permissions.hasPermission(group.permission)`; se a permission nova ainda não chegou no cache, o grupo continua oculto.

### Onde o cache é invalidado hoje
`src/contexts/AuthContext.tsx:260-263` só invalida ao **trocar de usuário** (login novo):
```ts
queryClient.invalidateQueries({ queryKey: ['app-roles-config'] });
```
Para a Alessandra já logada, nada dispara essa invalidação quando o admin salva mudanças em outro navegador.

## Conclusão
A regra "Acesso a Módulos realtime" do `mem://index.md` está cumprida — mas só para o caminho `user_module_visibility`. Os dois outros caminhos (atribuição de perfil e edição das permissões do perfil) ficam presos em cache local até reload. É por aí que Alessandra "perde" módulos liberados depois.

## Plano de correção

### A. `src/hooks/useAppRoles.ts` — fechar o gap das permissões do perfil
- Baixar `staleTime` para 60 s.
- Adicionar `refetchOnWindowFocus: true`.
- Adicionar um `useEffect` com canal Realtime em `public.app_roles_config` (sem filtro — é tabela pequena) que invalida `['app-roles-config']` em qualquer INSERT/UPDATE/DELETE.

### B. `src/contexts/AuthContext.tsx` — fechar o gap da atribuição de perfis
- Adicionar `useEffect` (após o de auth state) que, quando há `user.id`, abre um canal Realtime em `public.user_roles` com filtro `user_id=eq.{user.id}` e, em qualquer mudança:
  - limpa a memoização interna `PERFIS_PROMISES.delete(user.id)`,
  - rebusca via `fetchPerfis(user.id)`,
  - chama `setPerfis(...)` com o resultado,
  - invalida `['module-visibility', user.id]` e `['module-item-visibility', user.id]` para reavaliar overlays dependentes.
- Adicionar listener leve em `document.visibilitychange`: quando a aba volta para foco, refazer o mesmo refetch de perfis (defesa em camadas para casos em que o Realtime cai).

### C. Validação manual após implementar
Conectar como admin em uma aba e como Alessandra em outra; em uma terceira aba (ou no SQL editor):
1. Atribuir um novo perfil para ela em `user_roles` → conferir que o grupo correspondente aparece no sidebar da aba dela em poucos segundos, sem F5.
2. Editar `app_roles_config.permissions` do perfil `analista_cadastro` adicionando, por ex., `canManageSinistros` → conferir que "Eventos" passa a aparecer sem F5.
3. Remover ambos e conferir que somem.

Observações:
- Não vou alterar `useModuleVisibility` (já está correto) nem `useRouteGuard` (já é aditivo desde a correção anterior).
- Atualizar a regra Core em `mem://index.md` para refletir que a propagação realtime agora cobre as **três** fontes (user_module_visibility, user_roles, app_roles_config), não só a primeira.

### Arquivos a editar
- `src/hooks/useAppRoles.ts`
- `src/contexts/AuthContext.tsx`
- `mem://index.md` (e leaf `mem://logic/access/module-visibility-realtime-propagation` para incluir as duas novas fontes)
