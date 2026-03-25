
-- Insert analista_monitoramento role
INSERT INTO public.app_roles_config (role, label, description, area, sigla, color, icon_name, sort_order, is_active, permissions, area_icon, area_color, is_operational, redirect_path)
VALUES (
  'analista_monitoramento',
  'Analista de Monitoramento',
  'Analista responsável por acompanhamento e operações de monitoramento',
  'Monitoramento',
  'ANM',
  'teal',
  'Eye',
  11,
  true,
  '["canManageInstalacoes","canManageRastreadores","canManageOuvidoria","canViewDashboard"]'::jsonb,
  'Monitor',
  'teal',
  false,
  null
);

-- Add canCreateUser permission to coordenador_monitoramento
UPDATE public.app_roles_config
SET permissions = permissions::jsonb || '["canCreateUser"]'::jsonb
WHERE role = 'coordenador_monitoramento'
AND NOT (permissions::jsonb @> '["canCreateUser"]'::jsonb);
