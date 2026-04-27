
-- Conclui os 3 relatos cujas correções já foram entregues
UPDATE public.error_reports
SET 
  status = 'concluido'::error_report_status,
  tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
  tratado_em  = COALESCE(tratado_em, now()),
  concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
  concluido_em  = now(),
  observacao_diretor = COALESCE(observacao_diretor, '') ||
    CASE WHEN observacao_diretor IS NULL OR observacao_diretor = '' THEN '' ELSE E'\n\n' END ||
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || '] Correção aplicada — favor validar.',
  updated_at = now()
WHERE id IN (
  '65389042-a49e-478f-8fd8-44593aeb904b', -- datas Pré-Execução
  'f1c0b2d5-f886-4607-8f5a-0f4497d1c26e', -- buscar IMEI Softruck
  'cb57702f-a3be-49c3-983a-8c7d8ecf6db1'  -- filtro placa Softruck
);
