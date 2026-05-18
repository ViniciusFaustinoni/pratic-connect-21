
DO $$
DECLARE
  v_contrato uuid := '0aefdc1f-f2dd-43a9-bd6d-53b2bd446757';
  v_cotacao  uuid := '68e0ede7-0767-4749-bab0-41099fe29bee';
  v_associado uuid := 'edfa12e7-333d-4814-8767-06c87fda5365';
  v_veiculo  uuid := '79a83f1e-2166-4bf6-b907-4c179375e979';
  v_diretor  uuid := '0b78778b-d82c-434b-a981-f8a9f26353b4';  -- profiles.id
  v_data date    := DATE '2026-05-19';
  v_instalacao_id uuid;
BEGIN
  -- 1. Materializa instalação
  INSERT INTO instalacoes (
    associado_id, veiculo_id, contrato_id, cotacao_id,
    data_agendada, periodo, status, permite_encaixe,
    cep, logradouro, numero, bairro, cidade, uf,
    local_vistoria
  )
  SELECT v_associado, v_veiculo, v_contrato, v_cotacao,
         v_data, 'tarde'::periodo_instalacao, 'agendada'::status_instalacao, true,
         a.cep, a.logradouro, a.numero, a.bairro, a.cidade, a.uf,
         'cliente'
  FROM associados a WHERE a.id = v_associado
  RETURNING id INTO v_instalacao_id;

  -- 2. Cria serviço espelho (status agendada, sem concluida_em)
  INSERT INTO servicos (associado_id, veiculo_id, contrato_id, cotacao_id,
                        tipo, status, data_agendada, periodo)
  VALUES (v_associado, v_veiculo, v_contrato, v_cotacao,
          'instalacao', 'agendada', v_data, 'tarde');

  -- 3. Aprova Cadastro
  UPDATE contratos
     SET cadastro_aprovado = true,
         aprovado_por = v_diretor,
         aprovado_em  = now()
   WHERE id = v_contrato;
END $$;
