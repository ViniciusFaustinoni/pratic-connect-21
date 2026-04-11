UPDATE app_roles_config 
SET permissions = (
  SELECT permissions FROM app_roles_config WHERE role = 'coordenador_monitoramento'
)
WHERE role = 'analista_monitoramento';