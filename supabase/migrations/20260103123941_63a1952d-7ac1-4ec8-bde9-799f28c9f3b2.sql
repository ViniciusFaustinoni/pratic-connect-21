-- Corrigir view para não usar SECURITY DEFINER implícito
-- Recriar como view simples que respeita RLS

DROP VIEW IF EXISTS view_alertas_ativos;

CREATE VIEW view_alertas_ativos 
WITH (security_invoker = true)
AS
SELECT 
  a.id,
  a.rastreador_id,
  a.tipo,
  a.severidade,
  a.mensagem,
  a.dados,
  a.status,
  a.created_at,
  a.updated_at,
  r.codigo AS rastreador_codigo,
  r.plataforma,
  r.ultima_comunicacao,
  v.id AS veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  ass.id AS associado_id,
  ass.nome AS associado_nome,
  ass.telefone AS associado_telefone,
  ass.email AS associado_email,
  ROUND(EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 3600, 1) AS horas_aberto
FROM rastreador_alertas a
JOIN rastreadores r ON r.id = a.rastreador_id
LEFT JOIN veiculos v ON r.veiculo_id = v.id
LEFT JOIN associados ass ON v.associado_id = ass.id
WHERE a.status IN ('aberto', 'visualizado')
ORDER BY 
  CASE a.severidade 
    WHEN 'critica' THEN 1 
    WHEN 'alta' THEN 2 
    WHEN 'media' THEN 3 
    ELSE 4 
  END,
  a.created_at DESC;

COMMENT ON VIEW view_alertas_ativos IS 'Alertas abertos/visualizados com dados do veículo e associado';