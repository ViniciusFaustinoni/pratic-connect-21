UPDATE app_roles_config 
SET permissions = (
  SELECT jsonb_agg(DISTINCT val) 
  FROM (
    SELECT jsonb_array_elements_text(permissions::jsonb) AS val
    UNION 
    SELECT 'canUpdateEmail'
  ) sub
)
WHERE role = 'diretor' 
AND NOT (permissions::jsonb ? 'canUpdateEmail');