

# Corrigir Definição de Senha Aparecendo Duas Vezes

## Problema
Quando um associado define sua senha pela primeira vez via link/token (`app-criar-senha`), o campo `primeiro_acesso` no profile **não é marcado como `false`**. Ao fazer login em seguida, os guards (`AuthGuard`, `ProtectedRoute`, etc.) detectam `primeiro_acesso: true` e redirecionam para `/definir-senha` novamente — forçando o associado a definir a senha duas vezes.

## Causa raiz
No edge function `app-criar-senha`:
- **Caminho "novo usuário"** (linhas 172-184): cria o profile **sem** incluir `primeiro_acesso: false`, então o valor padrão do banco (`true`) é usado.
- **Profile criado por trigger**: se o trigger do auth já criou o profile, o código pula a criação mas **não atualiza** `primeiro_acesso` para `false`.

## Solução

### `supabase/functions/app-criar-senha/index.ts`

1. **Na inserção de novo profile** (linha 172-184): adicionar `primeiro_acesso: false` ao objeto de insert.

2. **Se profile já existe** (quando `existingProfile` é encontrado): adicionar um `update` para setar `primeiro_acesso: false` nesse profile existente.

```typescript
// Caminho 1: Profile novo — incluir primeiro_acesso: false
if (!existingProfile) {
  await supabase.from('profiles').insert({
    user_id: userId,
    nome: associado.nome,
    email: associado.email || email,
    telefone: associado.telefone,
    cpf: associado.cpf,
    tipo: 'associado',
    ativo: true,
    bloqueado: false,
    primeiro_acesso: false  // ← ADICIONAR
  });
} else {
  // Caminho 2: Profile já existe (trigger) — garantir primeiro_acesso = false
  await supabase.from('profiles')
    .update({ primeiro_acesso: false })
    .eq('user_id', userId);
}
```

### Deploy
Redeployar a edge function `app-criar-senha`.

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `supabase/functions/app-criar-senha/index.ts` | Adicionar `primeiro_acesso: false` nos dois caminhos de profile |

