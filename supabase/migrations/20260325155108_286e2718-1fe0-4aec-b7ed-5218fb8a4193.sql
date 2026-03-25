UPDATE public.app_roles_config
SET permissions = (
  SELECT jsonb_agg(elem)
  FROM (
    SELECT jsonb_array_elements(permissions::jsonb) AS elem
    UNION
    SELECT '"canResetPassword"'::jsonb
    UNION
    SELECT '"canUpdateEmail"'::jsonb
  ) sub
)
WHERE role = 'coordenador_monitoramento'