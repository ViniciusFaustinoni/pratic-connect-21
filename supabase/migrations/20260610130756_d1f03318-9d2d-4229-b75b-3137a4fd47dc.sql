
-- Resolve OU cria a vistoria canônica de um serviço, sem race entre abas/refetches.
-- Ordem: vistoria_origem_id → instalacao_origem_id → cotacao_id → dedupe por
-- (associado, veiculo, cotacao, 24h em_analise) → cria nova. Sempre amarra de
-- volta em servicos.vistoria_origem_id. Lock por servico via advisory lock para
-- serializar chamadas concorrentes (duas abas, refetches, etc).
CREATE OR REPLACE FUNCTION public.fn_obter_ou_criar_vistoria_servico(p_servico_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico RECORD;
  v_vistoria_id uuid;
BEGIN
  IF p_servico_id IS NULL THEN
    RAISE EXCEPTION 'p_servico_id obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- Serializa por servico_id (mesmo entre conexoes). Hash determinístico do uuid.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_servico_id::text, 0));

  SELECT
    s.id, s.associado_id, s.veiculo_id, s.profissional_id, s.contrato_id,
    s.cotacao_id, s.rota_id, s.vistoria_origem_id, s.instalacao_origem_id,
    s.data_agendada, s.hora_agendada, s.periodo,
    s.cep, s.logradouro, s.numero, s.bairro, s.cidade
  INTO v_servico
  FROM public.servicos s
  WHERE s.id = p_servico_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 1) vistoria_origem_id direto no serviço
  IF v_servico.vistoria_origem_id IS NOT NULL THEN
    SELECT id INTO v_vistoria_id
    FROM public.vistorias WHERE id = v_servico.vistoria_origem_id;
    IF v_vistoria_id IS NOT NULL THEN
      RETURN v_vistoria_id;
    END IF;
  END IF;

  -- 2) por instalacao_origem_id
  IF v_servico.instalacao_origem_id IS NOT NULL THEN
    SELECT id INTO v_vistoria_id
    FROM public.vistorias
    WHERE instalacao_id = v_servico.instalacao_origem_id
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_vistoria_id IS NOT NULL THEN
      UPDATE public.servicos SET vistoria_origem_id = v_vistoria_id WHERE id = p_servico_id;
      RETURN v_vistoria_id;
    END IF;
  END IF;

  -- 3) por cotacao_id
  IF v_servico.cotacao_id IS NOT NULL THEN
    SELECT id INTO v_vistoria_id
    FROM public.vistorias
    WHERE cotacao_id = v_servico.cotacao_id
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_vistoria_id IS NOT NULL THEN
      UPDATE public.servicos SET vistoria_origem_id = v_vistoria_id WHERE id = p_servico_id;
      RETURN v_vistoria_id;
    END IF;
  END IF;

  -- 4) dedupe defensivo: vistoria recente em_analise no mesmo trio
  IF v_servico.cotacao_id IS NOT NULL
     AND v_servico.associado_id IS NOT NULL
     AND v_servico.veiculo_id IS NOT NULL THEN
    SELECT id INTO v_vistoria_id
    FROM public.vistorias
    WHERE associado_id = v_servico.associado_id
      AND veiculo_id = v_servico.veiculo_id
      AND cotacao_id = v_servico.cotacao_id
      AND status = 'em_analise'
      AND created_at >= (now() - interval '24 hours')
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_vistoria_id IS NOT NULL THEN
      UPDATE public.servicos SET vistoria_origem_id = v_vistoria_id WHERE id = p_servico_id;
      RETURN v_vistoria_id;
    END IF;
  END IF;

  -- 5) cria nova
  INSERT INTO public.vistorias (
    associado_id, veiculo_id, vistoriador_id, contrato_id, cotacao_id,
    tipo, status,
    data_agendada, horario_agendado,
    endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade,
    rota_id
  ) VALUES (
    v_servico.associado_id, v_servico.veiculo_id, v_servico.profissional_id,
    v_servico.contrato_id, v_servico.cotacao_id,
    'entrada', 'em_analise',
    v_servico.data_agendada, v_servico.hora_agendada,
    v_servico.cep, v_servico.logradouro, v_servico.numero, v_servico.bairro, v_servico.cidade,
    v_servico.rota_id
  )
  RETURNING id INTO v_vistoria_id;

  UPDATE public.servicos SET vistoria_origem_id = v_vistoria_id WHERE id = p_servico_id;

  RETURN v_vistoria_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_obter_ou_criar_vistoria_servico(uuid) TO authenticated, service_role;
