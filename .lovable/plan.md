
# Analista de Eventos nao visualiza os Eventos

## Problema Identificado

O Analista de Eventos ainda esta acessando a interface mobile antiga (`/analista-eventos/fila`) que filtra apenas sinistros com `status = 'aguardando_analise'`. Alem disso:

1. O `AnalistaEventosGuard` redireciona para `/instalador/login` quando nao autenticado, e esse login nao redireciona o analista para `/dashboard`
2. O `AnalistaEventosLayout` ainda tem o header "Analista de Eventos" com a nav mobile antiga
3. Nao ha nenhum bloco no `useRouteGuard` que force o analista_eventos para fora das rotas `/analista-eventos/*` e em direcao ao `/dashboard`

## Solucao

Adicionar um redirecionamento no `useRouteGuard` para que o analista de eventos seja forçado para o sistema web quando tentar acessar `/analista-eventos/*`. Tambem ajustar o guard e o login redirect.

### Mudanca 1 — useRouteGuard: redirecionar analista_eventos para /dashboard

No `src/hooks/useRouteGuard.ts`, adicionar um bloco que detecta quando `isAnalistaEventosOnly` tenta acessar `/analista-eventos/*` e redireciona para `/dashboard`. Tambem restringir as rotas permitidas (similar ao analista de cadastro):

```
if (isAnalistaEventosOnly) {
  // Redirecionar das rotas mobile antigas para o sistema web
  if (location.pathname.startsWith('/analista-eventos')) {
    navigate('/dashboard', { replace: true });
    return;
  }
  
  // Rotas permitidas para o analista de eventos
  const allowedPaths = [
    '/dashboard',
    '/eventos',
    '/perfil',
    '/notificacoes',
  ];
  const isAllowed = allowedPaths.some(path =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  );
  if (!isAllowed) {
    navigate('/dashboard', { replace: true });
  }
}
```

### Mudanca 2 — InstaladorLogin: redirecionar analista_eventos para /auth

No `src/pages/instalador/InstaladorLogin.tsx`, adicionar no `useEffect` (linha 24-28) uma verificacao para `analista_eventos` que redireciona para `/dashboard` ao inves de ficar preso na tela de login do instalador.

### Mudanca 3 — AnalistaEventosGuard: redirecionar para /auth ao inves de /instalador/login

No `src/components/analista-eventos/AnalistaEventosGuard.tsx`, trocar o redirect de `/instalador/login` para `/auth` (caso as rotas antigas ainda sejam acessadas).

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useRouteGuard.ts` | Adicionar bloco de redirecionamento para `isAnalistaEventosOnly` — redirecionar de `/analista-eventos/*` para `/dashboard` e restringir rotas permitidas |
| `src/pages/instalador/InstaladorLogin.tsx` | Adicionar redirect para analista_eventos logado ir para `/dashboard` |
| `src/components/analista-eventos/AnalistaEventosGuard.tsx` | Trocar redirect de `/instalador/login` para `/auth` |

## Resultado

- Analista de eventos que acessa `/analista-eventos/*` sera automaticamente redirecionado para `/dashboard`
- Do dashboard, acessa "Eventos" na sidebar com a listagem completa de sinistros
- Se tentar logar via `/instalador/login`, sera redirecionado para `/dashboard`
- As rotas permitidas incluem `/dashboard`, `/eventos/*`, `/perfil` e `/notificacoes`
