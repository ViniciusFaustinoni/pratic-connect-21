DROP POLICY IF EXISTS "Insert taxa administrativa diretor" ON public.planos_taxa_administrativa;
DROP POLICY IF EXISTS "Update taxa administrativa diretor" ON public.planos_taxa_administrativa;
DROP POLICY IF EXISTS "Delete taxa administrativa diretor" ON public.planos_taxa_administrativa;

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