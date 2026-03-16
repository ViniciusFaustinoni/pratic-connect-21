

# Diagnóstico: Reloads e redirecionamentos involuntários

## Causa raiz identificada

O problema está no **`useSessionTimeout`** e como ele é usado no **`SessionTimeoutProvider`**.

### Cascata de re-renders infinita

1. **`handleTimeout` não é memoizado** (`SessionTimeoutProvider.tsx` linha 32) — é recriado a cada render
2. Dentro de `useSessionTimeout`, o `onTimeout` (que é `handleTimeout`) está na dependency array de:
   - `startCountdown` → recriado
   - `resetTimeout` → recriado (depende de `startCountdown`)
   - `handleActivity` → recriado (depende de `resetTimeout`)
3. O **useEffect de setup** (linha 150) depende de `handleActivity` e `resetTimeout` → **re-executa a cada render**, removendo e re-adicionando todos os event listeners + resetando timers
4. `handleActivity` também depende de `showWarning` (estado), criando outro ciclo de instabilidade

### Problema crítico ao voltar de tab minimizada

O **useEffect de visibilitychange** (linha 177) depende de `onTimeout` e `startCountdown`. Quando o usuário volta à tab:
- O elapsed time é calculado
- Se `elapsed >= timeoutDuration` (30min sistema / 60min app), **`onTimeout()` é chamado imediatamente** → faz `signOut()` + `navigate('/auth')` → o usuário é jogado para o login
- Como os timers são constantemente resetados pela cascata, o `lastActivityRef` pode ficar defasado

Isso explica exatamente o comportamento relatado: "minimiza ou troca de aba e ao voltar vai para o início".

## Correção

### 1. Memoizar `handleTimeout` no `SessionTimeoutProvider`

```tsx
const handleTimeout = useCallback(async () => {
  await signOut();
  const loginPath = variant === 'internal' ? '/auth' : '/app/login';
  navigate(loginPath, { replace: true, state: { reason: 'session_expired' } });
}, [signOut, navigate, variant]);
```

### 2. Usar refs para callbacks instáveis no `useSessionTimeout`

Padrão: armazenar `onTimeout` em um `useRef` e usar o ref dentro dos callbacks, removendo `onTimeout` das dependency arrays. Isso quebra a cascata:

```typescript
const onTimeoutRef = useRef(onTimeout);
useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);
```

Usar `onTimeoutRef.current()` em vez de `onTimeout()` dentro de `startCountdown`, `resetTimeout` e do handler de `visibilitychange`.

### 3. Estabilizar `handleActivity` removendo `showWarning` da dependency

Usar um ref para `showWarning` no debounce check, evitando que cada mudança de `showWarning` recrie todos os listeners.

### 4. Resetar `lastActivityRef` ao voltar de tab (se não expirou)

No handler de `visibilitychange`, quando o usuário volta e a sessão ainda é válida, atualizar `lastActivityRef.current = Date.now()` para evitar falsos positivos no próximo check.

## Arquivos alterados

- `src/components/auth/SessionTimeoutProvider.tsx` — memoizar `handleTimeout` com `useCallback`
- `src/hooks/useSessionTimeout.ts` — usar refs para callbacks instáveis, estabilizar dependencies

## Impacto

Corrige os reloads e redirecionamentos involuntários sem alterar a lógica de timeout em si. O timeout continuará funcionando corretamente (30min sistema, 60min app) mas sem causar re-renders em cascata.

