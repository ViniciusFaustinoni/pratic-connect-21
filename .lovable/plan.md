
# Plano: Corrigir Redirecionamento após Criação de Conta do Associado

## Diagnóstico

Identificamos uma **race condition** no fluxo de criação de conta do associado:

### Fluxo Atual (com bug)
```
CriarContaAssociadoForm.tsx
    │
    ├─ 1. Cria conta via Edge Function ✓
    ├─ 2. signInWithPassword() ✓
    └─ 3. navigate('/app/home') ❌ (imediato, sem aguardar profile)
            │
            └─► /app/home (ProtectedRoute)
                    │
                    ├─ user existe ✓
                    ├─ profile?.tipo = undefined (ainda carregando!)
                    └─ Redireciona para /app/login ❌
```

### Causa Raiz
O `navigate('/app/home')` na linha 91 do `CriarContaAssociadoForm.tsx` é executado imediatamente após o login, **sem aguardar** que o `AuthContext` termine de carregar o `profile` do usuário recém-logado.

O `ProtectedRoute` (linha 56-66) verifica `profile?.tipo`, e quando este é `undefined`, redireciona o usuário de volta para `/app/login`.

---

## Solução Proposta

Modificar o `CriarContaAssociadoForm.tsx` para **aguardar a confirmação de que o profile está carregado** antes de redirecionar.

### Abordagem: Polling Otimizado
Após o login bem-sucedido, fazer um polling curto verificando se o `AuthContext` já carregou o profile com `tipo === 'associado'` antes de navegar.

### Código da Correção

**Arquivo: `src/components/public/CriarContaAssociadoForm.tsx`**

```typescript
// Após signInWithPassword bem-sucedido (linha 88-91)

// Aguardar profile estar disponível no AuthContext
// Polling com timeout para evitar loop infinito
const maxAttempts = 20; // 20 tentativas x 150ms = 3 segundos max
let attempts = 0;

const waitForProfile = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const checkProfile = async () => {
      attempts++;
      
      // Verificar se profile foi carregado consultando o Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tipo')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (profile?.tipo === 'associado') {
          resolve(true);
          return;
        }
      }
      
      if (attempts >= maxAttempts) {
        resolve(false);
        return;
      }
      
      setTimeout(checkProfile, 150);
    };
    
    checkProfile();
  });
};

const profileReady = await waitForProfile();

if (profileReady) {
  toast.success('Bem-vindo ao PRATIC!');
  navigate('/app/home');
} else {
  // Fallback: redirecionar para login mesmo assim
  toast.success('Conta criada! Faça login para continuar.');
  navigate('/app/login');
}
```

### Alternativa Mais Simples (Recomendada)
Verificar diretamente no banco se o profile já existe antes de redirecionar:

```typescript
// Após signInWithPassword bem-sucedido (linhas 77-91)
if (loginError) {
  toast.success('Conta criada! Faça login com seu email.');
  navigate('/app/login');
  return;
}

// Verificar que o profile foi criado corretamente
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
  const { data: verifiedProfile } = await supabase
    .from('profiles')
    .select('id, tipo')
    .eq('user_id', session.user.id)
    .single();

  if (verifiedProfile?.tipo === 'associado') {
    toast.success('Bem-vindo ao PRATIC!');
    // Pequeno delay para AuthContext sincronizar
    await new Promise(r => setTimeout(r, 300));
    navigate('/app/home');
    return;
  }
}

// Fallback se algo der errado
toast.success('Conta criada! Faça login para continuar.');
navigate('/app/login');
```

---

## Arquivo a ser Modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/public/CriarContaAssociadoForm.tsx` | Adicionar verificação de profile antes de redirecionar |

---

## Benefícios

1. **Elimina race condition**: O redirecionamento só ocorre após confirmação de que os dados estão prontos
2. **Melhor UX**: Usuário é redirecionado corretamente para o app na primeira tentativa
3. **Fallback seguro**: Se algo falhar, usuário é direcionado para login manual (funcionalidade existente)
4. **Sem mudanças no AuthContext**: Mantém a arquitetura atual intacta

---

## Detalhes Técnicos

A solução segue o padrão recomendado no "Stack Overflow" de verificar a leitura dos dados antes de redirecionar:

> "Verify data readability: Use the ID of the newly created profile to perform a separate select query. This step confirms that the data is readable, taking into account RLS policies and any triggers that may have executed."
