
DO $$
DECLARE
  v_rastreador_id uuid := '59b58115-84e5-4220-ae88-aa60244e6087';
  v_veiculo_id    uuid := '0907831e-3791-4f3d-b46f-8485d923bf27';
  v_associado_id  uuid := '914e22e4-87d5-49ee-a2d3-163d3bb26154';
  v_instalacao_id uuid := '08c22b17-b6a3-4a9a-9749-a6b3324ac6ad';
  v_imei          text := '865209070727459';
  v_updated_rast  int;
  v_updated_inst  int;
BEGIN
  UPDATE public.rastreadores
     SET veiculo_id   = v_veiculo_id,
         associado_id = v_associado_id,
         status       = 'instalado',
         updated_at   = now()
   WHERE id = v_rastreador_id
     AND imei = v_imei
     AND veiculo_id IS NULL;
  GET DIAGNOSTICS v_updated_rast = ROW_COUNT;
  IF v_updated_rast = 0 THEN
    RAISE EXCEPTION 'Rastreador % já vinculado ou não encontrado', v_imei;
  END IF;

  UPDATE public.instalacoes
     SET status          = 'concluida',
         concluida_em    = now(),
         rastreador_id   = v_rastreador_id,
         imei_rastreador = v_imei,
         observacoes     = COALESCE(observacoes, '') ||
                           E'\n[Regularização administrativa] Instalação física concluída fora do app; ' ||
                           'rastreador IMEI ' || v_imei || ' vinculado em ' ||
                           to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
         updated_at      = now()
   WHERE id = v_instalacao_id
     AND status = 'cancelada';
  GET DIAGNOSTICS v_updated_inst = ROW_COUNT;
  IF v_updated_inst = 0 THEN
    RAISE EXCEPTION 'Instalação % não está mais cancelada', v_instalacao_id;
  END IF;
END$$;
