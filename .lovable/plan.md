
# Plano: Remover Login com Google

## Resumo
Remover completamente a funcionalidade de login com Google do sistema. Isso envolve remover:
1. O ícone SVG do Google
2. A função `handleGoogleLogin` na página de login
3. O botão de login com Google
4. A importação e chamada de `signInWithGoogle` no Login.tsx
5. A função `signInWithGoogle` no AuthContext.tsx
6. O export de `signInWithGoogle` do contexto

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/auth/Login.tsx` | Remover: ícone Google, handleGoogleLogin, botão Google, importação de signInWithGoogle |
| `src/contexts/AuthContext.tsx` | Remover: função signInWithGoogle, export da função |

## Detalhes das Mudanças

### 1. `src/pages/auth/Login.tsx`

**A remover:**

- **Linhas 42-64:** Componente `GoogleIcon` (não é mais necessário)
- **Linha 75:** `signInWithGoogle` da desestruturação do hook useAuth
- **Linhas 296-314:** Função `handleGoogleLogin` inteira
- **Linhas 527-537:** Botão de "Entrar com Google" (com Divisor acima se ficar vazio)

**Impacto:** 
- A página de login terá apenas a opção de login com email/senha
- Se houver um divisor/separador antes do botão Google, será removido também para manter a UI limpa

---

### 2. `src/contexts/AuthContext.tsx`

**A remover:**

- **Linhas 307-327:** Função `signInWithGoogle` inteira
- **Linha 583:** `signInWithGoogle` no array de retorno do provider

**Impacto:** 
- O contexto de autenticação não oferecerá mais a função de login com Google
- Usuários que usavam OAuth do Google não terão essa opção (apenas email/senha)

---

## Verificações Necessárias

Após remover, será necessário verificar:
1. ✅ A página de login está funcional (apenas email/senha)
2. ✅ Nenhuma outra página/componente referencia `signInWithGoogle`
3. ✅ O TypeScript não tem erros de imports/referências faltantes

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Remover ícone e handleGoogleLogin | 2 min |
| Remover botão Google | 1 min |
| Remover signInWithGoogle do AuthContext | 2 min |
| Testar página de login | 3 min |
| **Total** | **~8 min** |

