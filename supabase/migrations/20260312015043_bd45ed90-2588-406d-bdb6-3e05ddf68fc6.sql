
-- Add canApproveElegibilidade to diretor permissions
UPDATE public.app_roles_config 
SET permissions = permissions::jsonb || '["canApproveElegibilidade", "canViewElegibilidadePendente"]'::jsonb
WHERE role = 'diretor';

-- Add canViewElegibilidadePendente to supervisor_vendas permissions
UPDATE public.app_roles_config 
SET permissions = permissions::jsonb || '["canViewElegibilidadePendente"]'::jsonb
WHERE role = 'supervisor_vendas';
