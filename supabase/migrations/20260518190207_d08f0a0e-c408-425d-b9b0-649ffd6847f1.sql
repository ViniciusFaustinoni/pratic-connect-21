
-- 1) Reclassifica a vistoria como presencial de base
UPDATE vistorias
SET modalidade='presencial', origem='vistoria_base', updated_at=now(),
    observacoes = coalesce(observacoes,'') || E'\n[2026-05-18] Reclassificada de autovistoria para vistoria presencial de base — 31 fotos feitas presencialmente na base (correção manual).'
WHERE id='32d63e97-a445-4f18-a864-574dd2d5c28b';

-- 2) Cria o servico vistoria_entrada presencial concluida vinculado à vistoria
INSERT INTO servicos (
  tipo, status, modalidade, origem,
  contrato_id, associado_id, veiculo_id,
  vistoria_origem_id,
  data_agendada, concluida_em, analisado_em, analisado_por,
  observacoes
) VALUES (
  'vistoria_entrada', 'concluida', 'presencial', 'vistoria_base',
  '3912e435-e1f7-48af-8305-c1e7b277be79',
  '490c5ab4-87e8-4a84-b908-d45c89beb940',
  (SELECT id FROM veiculos WHERE placa='QQX4G67'),
  '32d63e97-a445-4f18-a864-574dd2d5c28b',
  CURRENT_DATE, now(), now(), '37beadcf-284b-4a2c-88a0-6efa8cae60d9',
  '[2026-05-18] Materializado manualmente — vistoria presencial de base com 31 fotos (LIDIA / QQX4G67). Encaminha à fila Monitoramento › Aprovação de Associados.'
);

-- 3) Aprova o cadastro (aprovado_por preenchido para não disparar trigger de auto-promoção)
UPDATE contratos
SET cadastro_aprovado=true,
    aprovado_por='37beadcf-284b-4a2c-88a0-6efa8cae60d9',
    aprovado_em=now(),
    updated_at=now()
WHERE id='3912e435-e1f7-48af-8305-c1e7b277be79';
