

# Corrigir criacao de senha em ambos os caminhos (link WhatsApp e pagina de acompanhamento)

## Problema

Existem dois caminhos para o associado criar sua senha, e ambos precisam funcionar mesmo quando o `ativar-associado` ja criou o `user_id`:

1. **Link do WhatsApp** (via `app-criar-senha` com token) -- JA CORRIGIDO na mudanca anterior
2. **Pagina de acompanhamento** (via `app-criar-conta-cliente`) -- AINDA BLOQUEADO

Na pagina de acompanhamento, dois bloqueios impedem o associado de criar a senha:
- Linha 226: condicao `!associado.user_id` esconde o formulario quando `user_id` ja existe
- Linha 75 da edge function: retorna erro "Voce ja possui uma conta" quando `user_id` existe

## Solucao

### 1. Mostrar formulario mesmo quando `user_id` ja existe (se `primeiro_acesso` for true)

**Arquivo**: `src/pages/public/AcompanhamentoProposta.tsx`

- Adicionar `primeiro_acesso` na interface `AssociadoData` (campo booleano)
- Na query (linhas 86-97), fazer join com `profiles` para buscar `primeiro_acesso`
- Na funcao `getStatusInfo` (linha 226), mudar condicao de:
  ```
  associado.status === 'ativo' && !associado.user_id
  ```
  Para:
  ```
  associado.status === 'ativo' && (!associado.user_id || associado.primeiro_acesso === true)
  ```

### 2. Atualizar senha em vez de rejeitar na edge function

**Arquivo**: `supabase/functions/app-criar-conta-cliente/index.ts`

Linhas 75-80: quando `associado.user_id` ja existe, em vez de retornar erro:
1. Usar `admin.updateUserById(associado.user_id, { password: senha })` para definir a senha
2. Atualizar `primeiro_acesso: false` no profile
3. Registrar historico
4. Retornar sucesso (sem flag `existingAccount`, para que o login automatico aconteca normalmente)

### 3. Garantir login automatico apos definir senha

O `CriarContaAssociadoForm.tsx` ja faz login automatico com `signInWithPassword` apos sucesso (linha 85-88). Basta garantir que a edge function retorne `success: true` sem `existingAccount: true`, e o fluxo existente fara o login + redirect para `/app/home`.

## Resultado esperado

Ambos os caminhos (link WhatsApp e pagina de acompanhamento) permitem que o associado defina sua propria senha, mesmo que o `ativar-associado` ja tenha criado o usuario Auth com senha padrao. Apos definir a senha, o associado e automaticamente logado e redirecionado para `/app/home`, sem nenhum clique adicional de "primeiro acesso".

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/public/AcompanhamentoProposta.tsx` | Buscar `primeiro_acesso` via join com profiles; mostrar formulario quando `primeiro_acesso === true` |
| `supabase/functions/app-criar-conta-cliente/index.ts` | Quando `user_id` ja existe, atualizar senha e marcar `primeiro_acesso: false` em vez de rejeitar |

