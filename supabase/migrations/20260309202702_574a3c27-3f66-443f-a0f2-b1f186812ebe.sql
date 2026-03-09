
ALTER TABLE public.app_roles_config 
  ADD COLUMN IF NOT EXISTS is_operational boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redirect_path text DEFAULT NULL;
