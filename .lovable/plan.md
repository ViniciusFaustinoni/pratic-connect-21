

# Corrigir conflito entre ativacao e criacao de senha do associado

## Problema

Existem dois fluxos conflitantes:

1. O analista ativa o associado via `ativar-associado`, que **ja cria o usuario no Auth** com senha padrao `Pratic@XXXX` e define o `user_id` no registro do associado
2. O associado recebe um link/token para criar sua propria senha via `app-criar-senha`, mas essa funcao verifica se `associado.user_id` ja existe e retorna erro: "Voce ja possui uma conta"

Resultado: a senha que o associado digita (ex: `12345678`) nunca e salva. A unica senha valida e a padrao gerada automaticamente.

## Solucao

Alterar a edge function `app-criar-senha` para que, quando o associado ja tenha `user_id` (criado pelo `ativar-associado`), em vez de retornar erro, **atualize a senha** do usuario existente e marque `primeiro_acesso: false`.

## Detalhe tecnico

### Arquivo: `supabase/functions/app-criar-senha/index.ts`

**Linhas 73-82**: Substituir o bloco que retorna erro quando `associado.user_id` existe.

De:
```typescript
if (associado.user_id) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Voce ja possui uma conta. Use "Esqueci minha senha".' 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

Para logica que:
1. Usa `admin.updateUserById(associado.user_id, { password: senha })` para atualizar a senha
2. Atualiza `primeiro_acesso: false` no profile
3. Marca o token como usado
4. Retorna sucesso

Se o associado **nao** tem `user_id`, mantemos o fluxo atual que cria o usuario do zero.

### Tambem corrigir: `src/pages/auth/DefinirSenha.tsx`

Buscar o campo `tipo` no profile e redirecionar para `/app/home` quando o tipo for `associado` (em vez de sempre redirecionar para `/dashboard`).

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/app-criar-senha/index.ts` | Quando `user_id` ja existe, atualizar senha em vez de retornar erro |
| `src/pages/auth/DefinirSenha.tsx` | Redirecionar associados para `/app/home` apos definir senha |

