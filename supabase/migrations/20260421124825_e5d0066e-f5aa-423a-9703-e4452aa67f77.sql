-- Remove FK conflitante que aponta para profiles.id (id interno do perfil).
-- A coluna cotacoes.vendedor_id deve referenciar auth.users(id) (ID de login),
-- já mantida pela constraint cotacoes_vendedor_id_fkey.
ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_vendedor_profiles_fkey;