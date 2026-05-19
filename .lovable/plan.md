## Problema

A edge `cancelar-troca-titularidade` retorna 500 com FK violation:

```
Key (reprovado_por)=(4218616b-...) is not present in table "profiles".
```

A coluna `solicitacoes_troca_titularidade.reprovado_por` referencia `profiles.id` (PK do profile), **não** `auth.users.id`. O código atual grava `user.id` (auth) diretamente, batendo na FK. Isso bate com a regra de memória `profile.id em comissões` (sistema usa `profile.id`, não `auth.users.id`).

## Correção

Em `supabase/functions/cancelar-troca-titularidade/index.ts`, antes do UPDATE, resolver o `profile.id` do usuário:

```ts
const { data: prof } = await admin
  .from('profiles')
  .select('id')
  .eq('user_id', user.id)
  .maybeSingle();

const reprovadoPor = prof?.id ?? null; // fallback null evita 500 caso o auth user não tenha profile
```

Trocar no UPDATE:
```ts
reprovado_por: reprovadoPor,
```

Nada mais muda (resto da função — idempotência, limpeza de `em_troca_titularidade`, WhatsApp best-effort — já está correto).

## Verificação

- Reabrir o drawer da troca KOU6D37 (Marcos Vinicius) → "Cancelar Troca de Titularidade" → confirmar.
- Esperado: 200 `{ success: true, status: 'cancelada' }`, solicitação muda para `cancelada`, `veiculos.em_troca_titularidade=false`.
- Conferir logs da edge sem erro 23503.