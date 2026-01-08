# Plano: Corrigir Exclusao de Leads (RLS DELETE Policy Ausente)

## Problema Identificado

O lead nao e excluido mesmo quando o toast "Lead excluido com sucesso" aparece. Investigacao revelou:

1. **O lead ainda existe no banco de dados** apos a "exclusao"
2. **Nao existe politica RLS para DELETE** na tabela `leads`
3. Politicas existentes:
   - `Sales can insert leads` (INSERT) - OK
   - `Sales can update own leads` (UPDATE) - OK
   - `Sales can view own leads` (SELECT) - OK
   - **DELETE** - AUSENTE!

4. O Supabase silenciosamente bloqueia o DELETE (RLS nega por padrao), retornando "0 rows affected" sem erro, e o codigo exibe o toast de sucesso incorretamente.

## Solucao

### Passo 1: Criar politica RLS para DELETE na tabela `leads`

**Arquivo afetado:** Migracao SQL no Supabase

**SQL a executar:**
```sql
-- Criar politica para permitir exclusao de leads
-- Mesmo criterio do UPDATE: proprietario do lead ou gerencia
CREATE POLICY "Sales can delete own leads" 
ON public.leads 
FOR DELETE 
TO authenticated 
USING (
  (vendedor_id = auth.uid()) 
  OR is_gerencia(auth.uid())
);
```

**Logica:**
- Vendedor pode excluir leads que sao seus (`vendedor_id = auth.uid()`)
- Gerencia pode excluir qualquer lead (`is_gerencia(auth.uid())`)
- Segue o mesmo padrao da politica de UPDATE existente

### Passo 2: Melhorar feedback de erro no codigo (opcional mas recomendado)

**Arquivo:** `src/hooks/useLeadActions.ts`

**Alteracao:** No `excluirLead`, verificar se realmente houve exclusao antes de exibir sucesso.

```typescript
// ANTES (linha 105-122)
const excluirLead = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
  onSuccess: () => {
    invalidateLeadQueries();
    toast.success('Lead excluido com sucesso!');
  },
  // ...
});

// DEPOIS
const excluirLead = useMutation({
  mutationFn: async (id: string) => {
    const { error, count } = await supabase
      .from('leads')
      .delete()
      .eq('id', id)
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    
    // Verificar se algum registro foi realmente excluido
    if (count === 0) {
      throw new Error('Nao foi possivel excluir o lead. Verifique suas permissoes.');
    }
  },
  onSuccess: () => {
    invalidateLeadQueries();
    toast.success('Lead excluido com sucesso!');
  },
  // ...
});
```

**Nota:** Alternativa mais simples e apenas adicionar a politica RLS, ja que o problema real e a falta de permissao.

## Arquivos Criticos para Implementacao

- **Migracao SQL** - Criar politica RLS para DELETE na tabela `leads`
- **src/hooks/useLeadActions.ts** - (Opcional) Melhorar verificacao de sucesso na exclusao

## Resultado Esperado

1. Ao clicar em "Excluir" e confirmar:
   - Lead e removido do banco de dados
   - Lead desaparece da lista imediatamente
   - Toast de sucesso aparece (apenas quando realmente excluido)

2. Se usuario nao tiver permissao:
   - Toast de erro aparece
   - Lead permanece na lista

## Checklist de Validacao

- [ ] Politica RLS `Sales can delete own leads` criada
- [ ] Vendedor consegue excluir seus proprios leads
- [ ] Gerencia consegue excluir qualquer lead
- [ ] Lead realmente desaparece apos exclusao
- [ ] Lead nao aparece na lista apos refresh
