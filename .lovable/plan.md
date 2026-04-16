

## Plano: Corrigir Loop de `history.replaceState()` no Safari

### Problema

O Safari limita `history.replaceState()` a 100 chamadas por 10 segundos. Após login, múltiplos hooks com `navigate(url, { replace: true })` disparam sem verificar se já estão na URL de destino, causando um loop infinito de redirecionamentos que o Error Boundary captura.

### Causa Raiz

Três pontos fazem `navigate(path, { replace: true })` sem verificar se `location.pathname` já é o destino:

1. **`useRouteGuard.ts`** (linha 61) — redireciona para o primeiro módulo visível sem checar se já está lá. Se `visibleModules` muda de referência entre renders, o efeito re-executa e navega de novo.

2. **`Auth.tsx`** (linha 92) — redireciona ao detectar `user + profile`, mas o componente pode re-renderizar antes de desmontar, disparando outra chamada.

3. **`Dashboard.tsx`** (linha 299) — redireciona instaladores para `/instalador` sem verificar se já está nessa rota.

No Chrome/Firefox, o replaceState é tolerado em volume. No Safari, o limite estrito causa o crash.

### Correção

Adicionar guarda `if (location.pathname !== targetPath)` antes de cada `navigate({ replace: true })` nos três arquivos, garantindo que a navegação só ocorra se a rota atual for diferente do destino.

#### 1. `src/hooks/useRouteGuard.ts`
- Linha 36: Adicionar `&& location.pathname !== redirectPath` antes de navegar para o path operacional.
- Linha 61: Adicionar `&& location.pathname !== firstRoute` antes de navegar para o primeiro módulo.

#### 2. `src/pages/Auth.tsx`
- Linha 91-93: Calcular `redirectTo` e só navegar se `location.pathname !== redirectTo`.

#### 3. `src/pages/Dashboard.tsx`
- Linha 299: Adicionar `&& location.pathname !== '/instalador'` à condição do efeito.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useRouteGuard.ts` | Guardar navegação com check de pathname atual |
| `src/pages/Auth.tsx` | Guardar navegação com check de pathname atual |
| `src/pages/Dashboard.tsx` | Guardar navegação com check de pathname atual |

### Impacto
Correção pontual sem mudança de comportamento — apenas evita chamar `navigate` quando já está no destino. Resolve o crash específico do Safari.

