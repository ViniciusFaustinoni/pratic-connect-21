
-- Re-populate permissions (previous migration rolled back)
UPDATE public.app_roles_config SET 
  permissions = '["canManageUsers","canManageLeads","canManagePlanos","canManageContratos","canManageApiSettings","canManageInstalacoes","canManageEquipeEstoque","canManageRastreadores","canViewDashboard","canManageCadastro","canManageOficinas","canManageSinistros","canApproveOS","canManageContabilidade","canManageJuridico","canManageRH","canManageMarketing","canManageOuvidoria","canManagePermissions","canApprovePermissionChanges","canCreateRoles","canManageConsultores","canManageEquipe","canViewReports","canEditRotas"]'::jsonb,
  area_icon = 'Code', area_color = 'violet'
WHERE role = 'desenvolvedor';

UPDATE public.app_roles_config SET 
  permissions = '["canManageUsers","canManageLeads","canManagePlanos","canManageContratos","canManageApiSettings","canManageInstalacoes","canManageEquipeEstoque","canManageRastreadores","canViewDashboard","canManageCadastro","canManageOficinas","canManageSinistros","canApproveOS","canManageContabilidade","canManageJuridico","canManageRH","canManageMarketing","canManageOuvidoria","canManagePermissions","canApprovePermissionChanges","canCreateRoles","canManageConsultores","canManageEquipe","canViewReports","canEditRotas"]'::jsonb,
  area_icon = 'Crown', area_color = 'purple'
WHERE role = 'diretor';

UPDATE public.app_roles_config SET 
  permissions = '["canManageUsers","canCreateRoles","canManageEquipeEstoque","canManageConsultores","canManageEquipe","canViewReports","canEditRotas","canViewDashboard","canManageOuvidoria"]'::jsonb,
  area_icon = 'ShieldCheck', area_color = 'purple'
WHERE role = 'admin_master';

UPDATE public.app_roles_config SET 
  permissions = '["canManageLeads","canManagePlanos","canManageContratos","canManageInstalacoes","canManageEquipeEstoque","canManageRastreadores","canViewDashboard","canManageCadastro","canManageOficinas","canManageSinistros","canApproveOS","canManageContabilidade","canManageJuridico","canManageRH","canManageMarketing","canManageOuvidoria","canManageConsultores","canManageEquipe","canViewReports","canEditRotas"]'::jsonb,
  area_icon = 'Briefcase', area_color = 'blue'
WHERE role = 'gerente_comercial';

UPDATE public.app_roles_config SET 
  permissions = '["canManageLeads","canViewDashboard"]'::jsonb,
  area_icon = 'Users', area_color = 'cyan'
WHERE role = 'supervisor_vendas';

UPDATE public.app_roles_config SET 
  permissions = '["canManageLeads","canViewDashboard"]'::jsonb,
  area_icon = 'UserCheck', area_color = 'green'
WHERE role = 'vendedor_clt';

UPDATE public.app_roles_config SET 
  permissions = '["canManageLeads","canViewDashboard"]'::jsonb,
  area_icon = 'UserPlus', area_color = 'green'
WHERE role = 'vendedor_externo';

UPDATE public.app_roles_config SET 
  permissions = '["canManageLeads","canViewDashboard"]'::jsonb,
  area_icon = 'Building', area_color = 'fuchsia'
WHERE role = 'agencia';

UPDATE public.app_roles_config SET 
  permissions = '["canManageCadastro","canManageOficinas","canManageSinistros","canManageOuvidoria","canViewReports","canViewDashboard"]'::jsonb,
  area_icon = 'FileCheck', area_color = 'orange'
WHERE role = 'analista_cadastro';

UPDATE public.app_roles_config SET 
  permissions = '["canManageInstalacoes","canManageEquipeEstoque","canManageRastreadores","canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'MapPin', area_color = 'teal'
WHERE role = 'coordenador_monitoramento';

UPDATE public.app_roles_config SET 
  permissions = '["canManageRastreadores","canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Monitor', area_color = 'teal'
WHERE role = 'analista_plataforma';

UPDATE public.app_roles_config SET 
  permissions = '["canManageInstalacoes","canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Wrench', area_color = 'pink'
WHERE role = 'instalador_vistoriador';

UPDATE public.app_roles_config SET 
  permissions = '["canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'ClipboardCheck', area_color = 'pink'
WHERE role = 'vistoriador_base';

UPDATE public.app_roles_config SET 
  permissions = '["canManageOficinas","canManageSinistros","canViewDashboard"]'::jsonb,
  area_icon = 'AlertTriangle', area_color = 'red'
WHERE role = 'analista_eventos';

UPDATE public.app_roles_config SET 
  permissions = '["canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Scale', area_color = 'red'
WHERE role = 'regulador';

UPDATE public.app_roles_config SET 
  permissions = '["canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Search', area_color = 'red'
WHERE role = 'sindicante';

UPDATE public.app_roles_config SET 
  permissions = '["canManageApiSettings","canManageMarketing","canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Megaphone', area_color = 'rose'
WHERE role = 'analista_marketing';

UPDATE public.app_roles_config SET 
  permissions = '["canManageJuridico","canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Scale', area_color = 'indigo'
WHERE role = 'analista_juridico';

UPDATE public.app_roles_config SET 
  permissions = '["canManageJuridico","canManageOuvidoria","canViewDashboard"]'::jsonb,
  area_icon = 'Gavel', area_color = 'indigo'
WHERE role = 'advogado';

UPDATE public.app_roles_config SET 
  permissions = '["canAccessApp"]'::jsonb,
  area_icon = 'User', area_color = 'slate'
WHERE role = 'associado';

-- Insert regioes_atendimento using valid categoria 'operacional'
INSERT INTO public.configuracoes (id, chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  gen_random_uuid(),
  'regioes_atendimento',
  '[{"value":"sp_centro","label":"São Paulo - Centro"},{"value":"sp_zona_sul","label":"São Paulo - Zona Sul"},{"value":"sp_zona_norte","label":"São Paulo - Zona Norte"},{"value":"sp_zona_leste","label":"São Paulo - Zona Leste"},{"value":"sp_zona_oeste","label":"São Paulo - Zona Oeste"},{"value":"abc","label":"ABC Paulista"},{"value":"campinas","label":"Campinas e Região"},{"value":"santos","label":"Santos e Baixada"},{"value":"sorocaba","label":"Sorocaba e Região"},{"value":"outros","label":"Outras Regiões"}]',
  'json',
  'operacional',
  'Regiões de atendimento para vistoriadores e instaladores',
  true
)
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
