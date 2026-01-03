-- Corrigir view para usar security_invoker (respeitar RLS do usuário)
DROP VIEW IF EXISTS view_rastreadores_posicao;

CREATE VIEW view_rastreadores_posicao 
WITH (security_invoker = true)
AS
SELECT 
  -- Dados do rastreador
  r.id AS rastreador_id,
  r.codigo,
  r.plataforma,
  r.id_plataforma,
  r.status,
  r.numero_serie,
  r.imei,
  
  -- Última posição
  r.ultima_comunicacao,
  r.ultima_posicao_lat AS latitude,
  r.ultima_posicao_lng AS longitude,
  r.ultima_velocidade AS velocidade,
  r.ultima_ignicao AS ignicao,
  
  -- Dados do veículo
  v.id AS veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  v.ano_modelo,
  v.cor,
  
  -- Dados do associado
  a.id AS associado_id,
  a.nome AS associado_nome,
  a.telefone AS associado_telefone,
  a.email AS associado_email,
  
  -- Cálculo de tempo sem comunicação (em horas)
  CASE 
    WHEN r.ultima_comunicacao IS NULL THEN 9999
    ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - r.ultima_comunicacao)) / 3600, 2)
  END AS horas_sem_comunicacao,
  
  -- Status de comunicação
  CASE 
    WHEN r.ultima_comunicacao IS NULL THEN 'sem_dados'
    WHEN r.ultima_comunicacao > NOW() - INTERVAL '1 hour' THEN 'online'
    WHEN r.ultima_comunicacao > NOW() - INTERVAL '24 hours' THEN 'atencao'
    ELSE 'offline'
  END AS status_comunicacao

FROM rastreadores r
LEFT JOIN veiculos v ON r.veiculo_id = v.id
LEFT JOIN associados a ON v.associado_id = a.id
WHERE r.status = 'instalado';

COMMENT ON VIEW view_rastreadores_posicao IS 'Rastreadores instalados com última posição e dados do veículo/associado';