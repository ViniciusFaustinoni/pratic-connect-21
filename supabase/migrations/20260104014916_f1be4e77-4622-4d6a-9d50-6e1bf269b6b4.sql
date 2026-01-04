
-- Corrigir views do RH para usar SECURITY INVOKER (comportamento seguro)
DROP VIEW IF EXISTS view_funcionarios_ativos;
DROP VIEW IF EXISTS view_aniversariantes_mes;

CREATE VIEW view_funcionarios_ativos 
WITH (security_invoker = on) AS
SELECT 
    f.*,
    c.nome as cargo_nome,
    c.nivel as cargo_nivel,
    d.nome as departamento_nome,
    g.nome_completo as gestor_nome,
    p.email as email_corporativo
FROM funcionarios f
LEFT JOIN cargos c ON c.id = f.cargo_id
LEFT JOIN departamentos d ON d.id = f.departamento_id
LEFT JOIN funcionarios g ON g.id = f.gestor_id
LEFT JOIN profiles p ON p.id = f.usuario_id
WHERE f.status != 'desligado';

CREATE VIEW view_aniversariantes_mes 
WITH (security_invoker = on) AS
SELECT 
    f.id,
    f.nome_completo,
    f.data_nascimento,
    f.foto_url,
    c.nome as cargo_nome,
    d.nome as departamento_nome,
    EXTRACT(DAY FROM f.data_nascimento) as dia
FROM funcionarios f
LEFT JOIN cargos c ON c.id = f.cargo_id
LEFT JOIN departamentos d ON d.id = f.departamento_id
WHERE f.status = 'ativo'
  AND EXTRACT(MONTH FROM f.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY EXTRACT(DAY FROM f.data_nascimento);
