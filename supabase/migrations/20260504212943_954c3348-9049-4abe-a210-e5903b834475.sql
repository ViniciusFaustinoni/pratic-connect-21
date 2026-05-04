CREATE OR REPLACE FUNCTION public.sync_instalacao_from_cotacao(p_cotacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cot RECORD;
  v_data date;
  v_periodo text;
  v_periodo_norm text;
  v_hora time;
  v_log text;
  v_num text;
  v_bai text;
  v_cid text;
  v_uf  text;
  v_cep text;
  v_lat numeric;
  v_lng numeric;
  v_inst_id uuid;
BEGIN
  SELECT
    tipo_vistoria,
    vistoria_data_agendada, vistoria_periodo, vistoria_horario_agendado,
    vistoria_endereco_logradouro, vistoria_endereco_numero, vistoria_endereco_bairro,
    vistoria_endereco_cidade, vistoria_endereco_estado, vistoria_endereco_cep,
    vistoria_endereco_latitude, vistoria_endereco_longitude,
    vistoria_completa_data_agendada, vistoria_completa_periodo, vistoria_completa_horario_agendado,
    vistoria_completa_endereco_logradouro, vistoria_completa_endereco_numero,
    vistoria_completa_endereco_bairro, vistoria_completa_endereco_cidade,
    vistoria_completa_endereco_estado, vistoria_completa_endereco_cep
  INTO v_cot
  FROM public.cotacoes WHERE id = p_cotacao_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_cot.tipo_vistoria = 'autovistoria' AND v_cot.vistoria_completa_data_agendada IS NOT NULL THEN
    v_data := v_cot.vistoria_completa_data_agendada;
    v_periodo := COALESCE(v_cot.vistoria_completa_periodo, v_cot.vistoria_completa_horario_agendado);
    v_log := v_cot.vistoria_completa_endereco_logradouro;
    v_num := v_cot.vistoria_completa_endereco_numero;
    v_bai := v_cot.vistoria_completa_endereco_bairro;
    v_cid := v_cot.vistoria_completa_endereco_cidade;
    v_uf  := v_cot.vistoria_completa_endereco_estado;
    v_cep := v_cot.vistoria_completa_endereco_cep;
    v_lat := v_cot.vistoria_endereco_latitude;
    v_lng := v_cot.vistoria_endereco_longitude;
  ELSE
    v_data := v_cot.vistoria_data_agendada;
    v_periodo := COALESCE(v_cot.vistoria_periodo, v_cot.vistoria_horario_agendado);
    v_log := v_cot.vistoria_endereco_logradouro;
    v_num := v_cot.vistoria_endereco_numero;
    v_bai := v_cot.vistoria_endereco_bairro;
    v_cid := v_cot.vistoria_endereco_cidade;
    v_uf  := v_cot.vistoria_endereco_estado;
    v_cep := v_cot.vistoria_endereco_cep;
    v_lat := v_cot.vistoria_endereco_latitude;
    v_lng := v_cot.vistoria_endereco_longitude;
  END IF;

  v_periodo_norm := CASE
    WHEN v_periodo ILIKE 'manh%' THEN 'manha'
    WHEN v_periodo ILIKE 'tarde%' THEN 'tarde'
    ELSE NULL
  END;

  v_hora := CASE
    WHEN v_periodo_norm = 'manha' THEN TIME '08:00'
    WHEN v_periodo_norm = 'tarde' THEN TIME '13:00'
    ELSE NULL
  END;

  IF v_data IS NULL OR v_log IS NULL OR v_periodo_norm IS NULL THEN RETURN; END IF;

  UPDATE public.instalacoes
     SET data_agendada = v_data,
         periodo = v_periodo_norm::periodo_instalacao,
         hora_agendada = v_hora,
         logradouro = v_log,
         numero = v_num,
         bairro = v_bai,
         cidade = v_cid,
         uf = v_uf,
         cep = v_cep,
         endereco_latitude = COALESCE(v_lat, endereco_latitude),
         endereco_longitude = COALESCE(v_lng, endereco_longitude),
         updated_at = now()
   WHERE cotacao_id = p_cotacao_id
     AND status NOT IN ('concluida','cancelada')
   RETURNING id INTO v_inst_id;

  UPDATE public.servicos
     SET data_agendada = v_data,
         periodo = v_periodo_norm::periodo_servico,
         hora_agendada = v_hora,
         logradouro = v_log,
         numero = v_num,
         bairro = v_bai,
         cidade = v_cid,
         uf = v_uf,
         cep = v_cep,
         latitude = COALESCE(v_lat, latitude),
         longitude = COALESCE(v_lng, longitude),
         updated_at = now()
   WHERE (
           (v_inst_id IS NOT NULL AND instalacao_origem_id = v_inst_id)
           OR cotacao_id = p_cotacao_id
         )
     AND status IN ('pendente','agendada','em_rota','reagendada');
END;
$$;

SELECT public.sync_instalacao_from_cotacao('575c0d11-c3d1-4a29-9d34-5edd664efdb4'::uuid);