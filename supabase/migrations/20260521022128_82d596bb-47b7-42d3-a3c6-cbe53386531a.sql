
-- PR-A2 saneamento Cat A (1 caso): CAIO HERCULANO GOMES DA SILVA
-- cotacao: 0b8b53a0-1823-4598-b65c-04df02a96862
-- contrato: ea20ff65-12c1-40a0-842d-4c58fc3387dd (já ativo)
-- veiculo: 1bd4806a-c656-457c-9a18-4a47ff0e6015 (em_analise, com rastreador + instalação concluída)
-- associado: 42cc456f-b1ad-4c15-b8a9-7a0690fa1454 (já ativo)
DO $$
DECLARE
  v_veiculo_id uuid := '1bd4806a-c656-457c-9a18-4a47ff0e6015';
  v_contrato_id uuid := 'ea20ff65-12c1-40a0-842d-4c58fc3387dd';
  v_associado_id uuid := '42cc456f-b1ad-4c15-b8a9-7a0690fa1454';
  v_status_antes text;
  v_rastreador_count int;
  v_inst_concluida int;
  v_status_depois text;
BEGIN
  -- Pré-check: confirmar premissas
  SELECT status INTO v_status_antes FROM veiculos WHERE id = v_veiculo_id;
  SELECT count(*) INTO v_rastreador_count FROM rastreadores WHERE veiculo_id = v_veiculo_id;
  SELECT count(*) INTO v_inst_concluida FROM instalacoes WHERE veiculo_id = v_veiculo_id AND status = 'concluida';

  IF v_status_antes <> 'em_analise' THEN
    RAISE EXCEPTION '[SANEAMENTO PR-A2] CAIO: status veiculo mudou para % - abortando', v_status_antes;
  END IF;
  IF v_rastreador_count < 1 THEN
    RAISE EXCEPTION '[SANEAMENTO PR-A2] CAIO: sem rastreador vinculado - abortando';
  END IF;
  IF v_inst_concluida < 1 THEN
    RAISE EXCEPTION '[SANEAMENTO PR-A2] CAIO: sem instalacao concluida - abortando';
  END IF;

  -- Promoção
  UPDATE veiculos SET status = 'ativo', updated_at = now() WHERE id = v_veiculo_id;

  -- Pós-check
  SELECT status INTO v_status_depois FROM veiculos WHERE id = v_veiculo_id;
  IF v_status_depois <> 'ativo' THEN
    RAISE EXCEPTION '[SANEAMENTO PR-A2] CAIO: promoção falhou, status atual %', v_status_depois;
  END IF;

  -- Auditoria
  INSERT INTO ativacao_status_log (associado_id, contrato_id, from_status, to_status, source, payload)
  VALUES (
    v_associado_id,
    v_contrato_id,
    'em_analise',
    'ativo',
    'saneamento_pr_a2',
    jsonb_build_object(
      'categoria', 'A',
      'veiculo_id', v_veiculo_id,
      'cotacao_id', '0b8b53a0-1823-4598-b65c-04df02a96862',
      'motivo', 'veiculo travado em em_analise apos instalacao concluida + rastreador vinculado + contrato ja ativo',
      'pre_check', jsonb_build_object(
        'rastreadores', v_rastreador_count,
        'inst_concluidas', v_inst_concluida,
        'status_antes', v_status_antes
      )
    )
  );

  RAISE NOTICE '[SANEAMENTO PR-A2] CAIO: veiculo % promovido em_analise -> ativo', v_veiculo_id;
END $$;
