
# Analista de Eventos: Migrar para Versao Web

## Situacao Atual

O perfil `analista_eventos` usa um layout mobile-first dedicado (`/analista-eventos`) com bottom navigation, header escuro e container `max-w-md`. O `useRouteGuard` forca o redirecionamento para `/analista-eventos` se o usuario tentar acessar qualquer outra rota.

## O que sera feito

Remover a restricao mobile e permitir que o analista de eventos acesse o sistema web completo (com sidebar, dashboard e as paginas de eventos existentes).

### Mudanca 1 — Adicionar permissao `canManageSinistros` ao analista de eventos

No `src/hooks/usePermissions.ts`, adicionar `isAnalistaEventos` na lista de perfis que possuem `canManageSinistros`. Isso faz o menu "Eventos" (Dashboard, Sinistros, Sindicancias) aparecer na sidebar.

```
// Antes:
canManageSinistros: hasRole('analista_cadastro') || isGerencia() || isDesenvolvedor,

// Depois:
canManageSinistros: hasRole('analista_cadastro') || isAnalistaEventos || isGerencia() || isDesenvolvedor,
```

### Mudanca 2 — Remover redirect forcado do useRouteGuard

No `src/hooks/useRouteGuard.ts`, remover o bloco que forca `analista_eventos` para `/analista-eventos`. O analista agora acessara `/dashboard` como qualquer funcionario web.

### Mudanca 3 — Remover `isAnalistaEventosOnly` de `isPerfilLimitado`

No `src/hooks/usePermissions.ts`, remover `isAnalistaEventosOnly` da lista `isPerfilLimitado`. Isso garante que o analista veja o menu lateral completo (sidebar) ao inves do menu simplificado de "Perfil".

### Mudanca 4 — Ajustar rotas permitidas no useRouteGuard

Adicionar rotas `/eventos/*`, `/dashboard` e `/perfil` como rotas permitidas para o analista de eventos (similar ao que ja existe para `isAnalistaCadastroOnly`), caso o perfil precise de restricao parcial. Alternativamente, simplesmente nao restringir o analista de eventos (ele acessa tudo que `canManageSinistros` permite via sidebar).

### Mudanca 5 — Manter rotas `/analista-eventos` como fallback

As rotas `/analista-eventos/*` continuam existindo no `App.tsx` para nao quebrar links antigos, mas o analista sera redirecionado para `/dashboard` ao fazer login.

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/usePermissions.ts` | Adicionar `isAnalistaEventos` em `canManageSinistros`, remover de `isPerfilLimitado` |
| `src/hooks/useRouteGuard.ts` | Remover bloco de redirect forcado para `/analista-eventos` |

## Resultado

- O analista de eventos faz login e ve o dashboard web com sidebar
- No menu lateral, aparece "Eventos" com Dashboard, Sinistros e Sindicancias
- Ele acessa as mesmas telas que diretores/gerentes usam para gerenciar eventos
- As rotas mobile `/analista-eventos/*` continuam funcionando como fallback
