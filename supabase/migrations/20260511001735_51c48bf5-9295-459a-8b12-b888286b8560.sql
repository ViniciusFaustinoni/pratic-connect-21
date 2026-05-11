
CREATE OR REPLACE FUNCTION public.fn_efetivar_troca_pos_vistoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol RECORD;
  v_novo_contrato RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NEW.tipo <> 'vistoria_entrada' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.origem, '') <> 'troca_titularidade' THEN RETURN NEW; END IF;
  IF NEW.cotacao_id IS NULL THEN RETURN NEW; END IF;

  IF NOT (
    (NEW.status IN ('aprovada', 'concluida'))
    AND COALESCE(NEW.decisao_instalador, '') IN ('aprovado', 'aprovado_ressalva')
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.decisao_instalador IS DISTINCT FROM NEW.decisao_instalador
    )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sol
  FROM public.solicitacoes_troca_titularidade
  WHERE cotacao_id = NEW.cotacao_id
    AND efetivada_em IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id, numero, associado_id INTO v_novo_contrato
  FROM public.contratos
  WHERE cotacao_id = v_sol.cotacao_id
    AND status IN ('assinado', 'pendente', 'aguardando_instalacao')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.contratos
     SET status = 'cancelado',
         data_cancelamento = v_now,
         motivo_cancelamento = COALESCE(motivo_cancelamento, 'Troca de titularidade'),
         updated_at = v_now
   WHERE associado_id = v_sol.associado_antigo_id
     AND id <> v_novo_contrato.id
     AND status IN ('ativo', 'pendente', 'assinado', 'aguardando_instalacao');

  UPDATE public.contratos
     SET status = 'ativo',
         data_ativacao = v_now,
         aprovado_em = COALESCE(aprovado_em, v_now),
         updated_at = v_now
   WHERE id = v_novo_contrato.id;

  UPDATE public.veiculos
     SET associado_id = v_novo_contrato.associado_id,
         em_troca_titularidade = false,
         troca_titularidade_id = NULL,
         troca_titularidade_iniciada_em = NULL,
         cobertura_suspensa = false,
         cobertura_suspensa_em = NULL,
         cobertura_suspensa_motivo = NULL,
         updated_at = v_now
   WHERE id = v_sol.veiculo_id;

  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'efetivada',
         efetivada_em = v_now,
         novo_associado_id = v_novo_contrato.associado_id,
         updated_at = v_now
   WHERE id = v_sol.id;

  INSERT INTO public.contratos_historico (contrato_id, evento, descricao, dados)
  VALUES (
    v_novo_contrato.id,
    'efetivado_troca_titularidade',
    format('Troca de titularidade efetivada após aprovação do Monitoramento (serviço %s)', NEW.id),
    jsonb_build_object('solicitacao_id', v_sol.id, 'servico_id', NEW.id, 'associado_antigo_id', v_sol.associado_antigo_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_efetivar_troca_pos_vistoria ON public.servicos;
CREATE TRIGGER trg_efetivar_troca_pos_vistoria
AFTER UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_efetivar_troca_pos_vistoria();

-- Backfill LTB4J74
DO $$
DECLARE
  v_sol_id UUID := '31330683-a143-4a3e-9a1f-7db6d112a165';
  v_veic_id UUID := '8a1b4af8-880c-4d71-b6f5-8e347c55fa3f';
  v_contrato_novo UUID := 'ffa337d3-07ea-4603-99de-52466b9bb12c';
  v_assoc_id UUID := 'a4e62fa5-c217-48c3-acd7-9390f13985eb';
  v_cot_id UUID := '6f29fc8c-7933-4f71-9d8a-98d35863380c';
  v_servico_id UUID;
  v_existing UUID;
BEGIN
  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'aguardando_vistoria', efetivada_em = NULL, updated_at = now()
   WHERE id = v_sol_id;

  UPDATE public.veiculos
     SET cobertura_suspensa = true,
         cobertura_suspensa_em = now(),
         cobertura_suspensa_motivo = 'troca_titularidade_em_andamento',
         em_troca_titularidade = true,
         troca_titularidade_id = v_sol_id,
         troca_titularidade_iniciada_em = COALESCE(troca_titularidade_iniciada_em, now()),
         updated_at = now()
   WHERE id = v_veic_id;

  UPDATE public.contratos
     SET status = 'assinado', data_ativacao = NULL, updated_at = now()
   WHERE id = v_contrato_novo AND status = 'ativo';

  SELECT id INTO v_existing FROM public.servicos
   WHERE veiculo_id = v_veic_id
     AND tipo = 'vistoria_entrada'
     AND status IN ('pendente','agendada','em_rota','em_andamento','em_analise','reagendada')
   LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.servicos (
      tipo, status, origem, modalidade, associado_id, veiculo_id,
      contrato_id, cotacao_id,
      data_agendada, periodo, observacoes, solicitado_por_modulo
    ) VALUES (
      'vistoria_entrada', 'pendente', 'troca_titularidade', 'presencial',
      v_assoc_id, v_veic_id, v_contrato_novo, v_cot_id,
      (CURRENT_DATE + INTERVAL '1 day')::date, 'manha',
      'Backfill — vistoria de troca de titularidade (LTB4J74). Aprovação do Monitoramento obrigatória.',
      'troca_titularidade'
    ) RETURNING id INTO v_servico_id;
  ELSE
    v_servico_id := v_existing;
  END IF;

  UPDATE public.solicitacoes_troca_titularidade
     SET servico_vistoria_id = v_servico_id
   WHERE id = v_sol_id;
END $$;
