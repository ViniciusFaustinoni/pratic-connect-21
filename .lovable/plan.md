

## Plano: Corrigir RLS do storage para assinaturas em página pública

### Causa raiz

A página `AcompanhamentoProposta.tsx` é pública (sem login), mas usa o client autenticado (`supabase`) para fazer upload no bucket `assinaturas`. A RLS policy exige `auth.uid()`, que é null para anon, causando o erro "new row violates row-level security policy".

A mesma página também faz `UPDATE` na tabela `servicos` para salvar `assinatura_cliente_url`. Já existe uma policy anon para update em `servicos` (condicionada a `reagendamento_token IS NOT NULL`), mas o serviço de instalação pode não ter esse token. A solução mais segura é delegar upload + update para uma Edge Function.

### Alterações

**1. `src/pages/public/AcompanhamentoProposta.tsx`**
- Trocar `supabase` por `publicSupabase` no `handleSalvarAssinatura`
- Ou melhor: invocar uma Edge Function existente ou o hook `useSaveAssinatura` com `publicSupabase`

**2. Migration SQL — Permitir anon upload no bucket `assinaturas`**
- Criar policy `Anon can upload assinaturas` no `storage.objects` para `INSERT TO anon` com `bucket_id = 'assinaturas'`
- Criar policy `Anon can update assinaturas` para `UPDATE TO anon` (upsert precisa)

**3. Migration SQL — Permitir anon update de `assinatura_cliente_url` em `servicos`**
- A policy anon de update existente exige `reagendamento_token IS NOT NULL`. Precisamos ou: (a) ampliar para permitir update quando o serviço está vinculado a um contrato público, ou (b) delegar a operação para uma Edge Function com service_role.

A abordagem mais simples e segura: usar `publicSupabase` para o upload (com nova RLS anon) e chamar uma Edge Function para o update do `servicos` (evita abrir RLS de update desnecessariamente).

**Abordagem escolhida (mais simples):** Apenas adicionar policies anon no storage + na tabela `servicos` para update limitado, e trocar para `publicSupabase`.

### Detalhes técnicos

1. **Migration**: 
   - `INSERT TO anon` em `storage.objects` onde `bucket_id = 'assinaturas'`
   - `UPDATE TO anon` em `storage.objects` onde `bucket_id = 'assinaturas'` (para upsert)
   - Ampliar policy de update anon em `servicos` para cobrir serviços sem `reagendamento_token`

2. **Código**: Trocar `import { supabase }` por `import { publicSupabase }` e usar `publicSupabase` no `handleSalvarAssinatura`

### Resultado
- Upload de assinatura na página pública funcionará sem erro de RLS
- A assinatura será salva corretamente no bucket e o URL atualizado no serviço

