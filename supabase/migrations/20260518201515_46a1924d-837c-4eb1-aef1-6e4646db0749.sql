DO $$
DECLARE
  v_now timestamptz := now();
BEGIN
  UPDATE veiculos
    SET cobertura_roubo_furto = true, updated_at = v_now
    WHERE id = '14c2e181-285c-46f2-8b64-0fe96f79fcdd';

  UPDATE vistorias
    SET status = 'aprovada', analisado_em = v_now, updated_at = v_now
    WHERE id = '3d23689a-996f-4c14-b75d-16f8396a795f';

  UPDATE servicos
    SET status = 'aprovada',
        concluida_em = NULL,
        analisado_em = v_now,
        observacoes_analise = 'Liberação manual de R/F pelo Monitoramento — fotos validadas; vídeo 360° dispensado. Instalação técnica segue no agendamento.',
        updated_at = v_now
    WHERE id = 'cffe1b70-bd7c-4820-8c05-47d604b2b096';

  INSERT INTO associados_historico (associado_id, contrato_id, tipo, descricao)
  VALUES (
    '6a1efe00-2274-4bb6-8cb2-bea665e1b264',
    '320ac766-18de-4066-a1ad-86d1685b7754',
    'status_alterado',
    'Cobertura Roubo/Furto liberada manualmente pelo Monitoramento (veículo QXT9H99). Vídeo 360° dispensado; instalação do rastreador segue no agendamento já marcado.'
  );
END $$;