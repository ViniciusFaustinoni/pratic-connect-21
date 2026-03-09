
-- Set operational roles
UPDATE public.app_roles_config SET is_operational = true, redirect_path = '/instalador' WHERE role = 'instalador_vistoriador';
UPDATE public.app_roles_config SET is_operational = true, redirect_path = '/instalador' WHERE role = 'vistoriador_base';
UPDATE public.app_roles_config SET is_operational = true, redirect_path = '/regulador' WHERE role = 'regulador';
UPDATE public.app_roles_config SET is_operational = true, redirect_path = '/sindicante' WHERE role = 'sindicante';

-- Add new capability permissions to diretor
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canManageComissoes","canApproveComissoes","canDeleteCotacao","canDeleteAssociado","canDeleteSinistro","canCreateTemplate","canEditTemplate","canDeleteTemplate","canCreateUser","canImportUsers","canResetPassword","canDeleteAtivacao","canManageIntegracoes"]'::jsonb WHERE role = 'diretor';
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canManageComissoes","canApproveComissoes","canDeleteCotacao","canDeleteAssociado","canDeleteSinistro","canCreateTemplate","canEditTemplate","canDeleteTemplate","canCreateUser","canImportUsers","canResetPassword","canDeleteAtivacao","canManageIntegracoes"]'::jsonb WHERE role = 'desenvolvedor';
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canManageComissoes","canApproveComissoes","canCreateTemplate","canEditTemplate","canDeleteTemplate","canCreateUser","canImportUsers"]'::jsonb WHERE role = 'gerente_comercial';
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canManageComissoes","canCreateUser","canImportUsers"]'::jsonb WHERE role = 'supervisor_vendas';
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canCreateUser"]'::jsonb WHERE role = 'analista_eventos';
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canCreateTemplate","canEditTemplate"]'::jsonb WHERE role = 'analista_cadastro';
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canDeleteAtivacao","canResetPassword","canManageIntegracoes"]'::jsonb WHERE role = 'admin_master';
