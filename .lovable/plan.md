
# Corrigir Edição de Contatos do Associado

## Problema Identificado

A função `handleSaveContatos` em `AssociadoDetalhe.tsx` faz um `supabase.update()` que, quando bloqueado por RLS, retorna **sem erro** (PostgREST não reporta erro quando 0 rows são afetadas). O código interpreta isso como sucesso, exibe "Contatos atualizados com sucesso", mas os dados não persistem.

Embora a policy `Staff can manage associates` (ALL, `is_funcionario(auth.uid())`) deveria permitir a atualização, pode haver um conflito sutil com a policy UPDATE específica para anon+authenticated. Além disso, o código não verifica se a atualização realmente afetou alguma linha.

## Solução

Duas correções complementares:

### 1. Verificar se o update afetou rows (garantia de feedback correto)

No `handleSaveContatos`, usar `.select()` após o `.update()` para verificar se dados foram retornados. Se não, tratar como erro.

```typescript
const { data, error } = await supabase
  .from('associados')
  .update({
    telefone: editTelefone,
    telefone_secundario: editTelefoneSecundario || null,
    email: editEmail,
    updated_at: new Date().toISOString(),
  })
  .eq('id', id)
  .select()
  .single();

if (error) throw error;
if (!data) throw new Error('Nenhum registro atualizado');
```

### 2. Usar edge function RPC como fallback seguro

Criar uma função SQL `update_associado_contatos` com SECURITY DEFINER que só permite funcionários atualizarem, contornando qualquer conflito de policies:

```sql
CREATE OR REPLACE FUNCTION update_associado_contatos(
  _associado_id uuid,
  _telefone text,
  _telefone_secundario text,
  _email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_funcionario(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  
  UPDATE associados
  SET telefone = _telefone,
      telefone_secundario = _telefone_secundario,
      email = _email,
      updated_at = now()
  WHERE id = _associado_id;
END;
$$;
```

E no frontend, substituir o update direto por `supabase.rpc('update_associado_contatos', {...})`.

## Arquivos Alterados

| Arquivo | Ação |
|---------|------|
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Usar `.select().single()` no update + tratar caso de 0 rows |
| Migration SQL | Criar função `update_associado_contatos` como fallback |

## Abordagem recomendada

Começar pela **correção 1** (`.select().single()`) que é mínima e já resolve o feedback falso de sucesso. Se o update realmente falha por RLS, o erro ficará visível e poderemos aplicar a correção 2 (RPC function).
