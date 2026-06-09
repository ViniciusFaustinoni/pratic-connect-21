INSERT INTO public.app_roles_config (
  role, label, description, area, sigla, color, icon_name, sort_order,
  is_active, permissions, area_icon, area_color, is_operational, redirect_path
) VALUES (
  'relacionamento',
  'Relacionamento',
  'Acesso às áreas de Relacionamento, Cadastro, Comercial e Monitoramento',
  'Relacionamento',
  'Rel',
  'red',
  'MessageCircle',
  15,
  true,
  '["canViewDashboard","canManageLeads","canManageCadastro","canManageInstalacoes","canManageRastreadores","canManageEquipeEstoque","canManageEmailsSuspensao"]'::jsonb,
  'MessageCircle',
  'red',
  false,
  NULL
)
ON CONFLICT (role) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  area = EXCLUDED.area,
  sigla = EXCLUDED.sigla,
  color = EXCLUDED.color,
  icon_name = EXCLUDED.icon_name,
  permissions = EXCLUDED.permissions,
  area_icon = EXCLUDED.area_icon,
  area_color = EXCLUDED.area_color,
  is_active = true;

INSERT INTO public.role_module_visibility (role, module_id, visible) VALUES
  ('relacionamento', 'dashboard', true),
  ('relacionamento', 'relacionamento', true),
  ('relacionamento', 'cobranca', true),
  ('relacionamento', 'cadastro', true),
  ('relacionamento', 'vendas', true),
  ('relacionamento', 'monitoramento', true)
ON CONFLICT (role, module_id) DO UPDATE SET visible = EXCLUDED.visible;