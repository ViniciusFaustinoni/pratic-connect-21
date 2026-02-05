
# Plano: Corrigir Flicker na Tela de Login

## Problema Identificado

O "piscar" ocorre porque existem **dois fluxos de redirecionamento competindo** após o login bem-sucedido:

1. **handleSubmit** (Login.tsx): Faz navigate() após buscar profile manualmente
2. **useEffect** (Login.tsx): Faz navigate() quando detecta `user` + `!authLoading`

Além disso, o `signIn()` no AuthContext seta `loading = false` no `finally`, **antes** do `onAuthStateChange` terminar de carregar os dados do usuário.

---

## Solução

### Correção 1: Não fazer navigate() duplicado no handleSubmit

O `handleSubmit` não precisa buscar profile e fazer navigate manualmente - o `useEffect` já faz isso. Basta retornar após login bem-sucedido e deixar o useEffect cuidar do redirecionamento.

### Correção 2: Aguardar profile no useEffect antes de redirecionar

O `useEffect` deve verificar não apenas `user`, mas também que o `profile` foi carregado, evitando redirecionamento prematuro.

### Correção 3: Usar flag de "login em andamento"

Adicionar um estado `loginEmAndamento` que permanece `true` até que o fluxo complete totalmente, evitando re-renderizações intermediárias.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/auth/Login.tsx` | Simplificar handleSubmit e melhorar useEffect |

---

## Código Corrigido

### Login.tsx - useEffect para redirecionamento

```typescript
// ANTES: Redireciona assim que tem user
useEffect(() => {
  if (!authLoading && user) {
    // ...navigate
  }
}, [authLoading, user, ...]);

// DEPOIS: Aguarda profile também
useEffect(() => {
  // Só redireciona quando tiver user E profile carregado
  if (!authLoading && user && profile) {
    if (profile.primeiro_acesso) {
      navigate('/definir-senha', { replace: true });
      return;
    }
    if (isAssociado) {
      navigate('/app/home', { replace: true });
      return;
    }
    const params = new URLSearchParams(location.search);
    const returnTo = params.get('returnTo') || '/dashboard';
    navigate(returnTo, { replace: true });
  }
}, [authLoading, user, profile, isAssociado, navigate, location.search]);
```

### Login.tsx - handleSubmit simplificado

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (!validateForm() || bloqueado) return;

  setIsSubmitting(true);

  try {
    const result = await signIn({ 
      email: formData.email.trim().toLowerCase(), 
      password: formData.password 
    });

    if (!result.success) {
      const errorType = parseSupabaseError(result.error || '');
      setError(errorType);
      await registrarTentativaFalha(formData.email, errorType);
      setIsSubmitting(false);
      return;
    }

    // Login bem-sucedido - registrar e aguardar useEffect fazer o redirect
    await registrarTentativaSucesso(formData.email);
    // NÃO fazer navigate aqui - o useEffect vai fazer quando profile carregar
    // Manter isSubmitting = true para mostrar loading até redirecionar
    
  } catch (err) {
    setError('unknown_error');
    await registrarTentativaFalha(formData.email, 'unknown_error');
    setIsSubmitting(false);
  }
  // NÃO colocar setIsSubmitting(false) no finally!
};
```

### Login.tsx - Loading state melhorado

```typescript
// Adicionar profile nas dependências
const { signIn, signInWithGoogle, user, profile, loading: authLoading, isAssociado } = useAuth();

// Estado de loading composto
const showLoadingScreen = authLoading || (user && !profile);

if (showLoadingScreen) {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center">
      {/* ... loading spinner ... */}
    </div>
  );
}
```

---

## Fluxo Corrigido

```text
1. Usuário digita credenciais → Clica "Entrar"
2. isSubmitting = true (mostra spinner no botão)
3. signIn() é chamado → Login bem-sucedido
4. registrarTentativaSucesso() → return (NÃO faz navigate)
5. AuthContext: onAuthStateChange(SIGNED_IN)
   → setUser(user)
   → setTimeout → loadUserData()
6. AuthContext: loadUserData()
   → Busca profile + perfis
   → setProfile(), setPerfis()
   → setLoading(false)
7. Login.tsx: useEffect detecta user + profile
   → Agora sim faz navigate() UMA VEZ SÓ
8. Redirecionamento limpo, sem flicker
```

---

## Benefícios

- Elimina a "corrida" entre dois navigates
- Tela de loading permanece até dados estarem completos
- Código mais simples e previsível
- Mensagem de boas-vindas pode usar dados do profile já carregado

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Modificar Login.tsx | 10 min |
| Testar fluxo | 5 min |
| **Total** | **~15 min** |
