-- Add canGenerateLinkEvento permission to roles that need it
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canGenerateLinkEvento"]'::jsonb WHERE role IN ('diretor', 'desenvolvedor', 'admin_master', 'regulador', 'analista_sinistros', 'gerente_comercial');

-- Add canAnalyzeExclusivity permission
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canAnalyzeExclusivity"]'::jsonb WHERE role IN ('diretor', 'desenvolvedor', 'admin_master', 'gerente_comercial');

-- Add canViewAudit permission for Vendedores page audit access
UPDATE public.app_roles_config SET permissions = permissions::jsonb || '["canViewAudit"]'::jsonb WHERE role IN ('diretor', 'gerente_comercial', 'desenvolvedor', 'admin_master');