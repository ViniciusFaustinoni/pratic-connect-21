-- Restaura role analista_monitoramento para MATHEUS TROYACK E SILVA
-- (perdeu a role ao salvar o form de Editar Usuário sem perfis selecionados)
INSERT INTO public.user_roles (user_id, role)
SELECT '2c5b9ad6-cf47-47ce-917f-75df9800601f'::uuid, 'analista_monitoramento'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = '2c5b9ad6-cf47-47ce-917f-75df9800601f'
    AND role = 'analista_monitoramento'
);