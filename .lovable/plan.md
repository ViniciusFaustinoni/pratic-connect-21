

# Corrigir RLS da Taxa Administrativa - Permissão Incorreta

## Problema

A tabela `planos_taxa_administrativa` usa a permissão `canManagePlans` nas policies de INSERT, UPDATE e DELETE. Porém, o papel `diretor` possui a permissão `canManagePlanos` (em português). O nome não bate, causando erro RLS `42501` ao tentar salvar.

## Correção

### Migração SQL
Recriar as 3 policies (INSERT, UPDATE, DELETE) trocando `canManagePlans` por `canManagePlanos`:

```sql
DROP POLICY "Insert taxa administrativa diretor" ON public.planos_taxa_administrativa;
DROP POLICY "Update taxa administrativa diretor" ON public.planos_taxa_administrativa;
DROP POLICY "Delete taxa administrativa diretor" ON public.planos_taxa_administrativa;

CREATE POLICY "Insert taxa administrativa diretor"
  ON public.planos_taxa_administrativa FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'canManagePlanos'));

CREATE POLICY "Update taxa administrativa diretor"
  ON public.planos_taxa_administrativa FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'canManagePlanos'))
  WITH CHECK (public.has_permission(auth.uid(), 'canManagePlanos'));

CREATE POLICY "Delete taxa administrativa diretor"
  ON public.planos_taxa_administrativa FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'canManagePlanos'));
```

Nenhuma alteração de código necessária.

