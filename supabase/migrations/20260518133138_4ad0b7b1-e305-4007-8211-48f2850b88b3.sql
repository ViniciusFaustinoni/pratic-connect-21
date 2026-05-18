
-- =====================================================================
-- FIX: autovistoria do cliente NUNCA deve auto-promover cadastro_aprovado
-- Causa raiz do caso Andreia (cot 68e0ede7…): trigger trg_servico_promove_cadastro
-- não distinguia modalidade='autovistoria' de vistoria presencial.
-- =====================================================================

-- Frente 1: blindar fn_trg_servico_promove_cadastro
CREATE OR REPLACE FUNCTION public.fn_trg_servico_promove_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contrato_id uuid;
  _origem_modalidade text;
BEGIN
  IF NEW.status::text NOT IN ('concluida','aprovada','aprovada_ressalvas') THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo::text NOT IN ('instalacao','vistoria_entrada') THEN
    RETURN NEW;
  END IF;

  -- BLINDAGEM: autovistoria do cliente nunca dispensa análise documental do Cadastro
  IF NEW.modalidade::text = 'autovistoria' THEN
    RETURN NEW;
  END IF;

  -- Blindagem extra: se origem vier de vistoria com modalidade autovistoria, idem
  IF NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT v.modalidade::text INTO _origem_modalidade
      FROM public.vistorias v WHERE v.id = NEW.vistoria_origem_id;
    IF _origem_modalidade = 'autovistoria' THEN
      RETURN NEW;
    END IF;
  END IF;

  _contrato_id := NEW.contrato_id;

  IF _contrato_id IS NULL AND NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT v.contrato_id INTO _contrato_id
      FROM public.vistorias v WHERE v.id = NEW.vistoria_origem_id;
  END IF;

  IF _contrato_id IS NULL AND NEW.cotacao_id IS NOT NULL THEN
    SELECT c.id INTO _contrato_id
      FROM public.contratos c
     WHERE c.cotacao_id = NEW.cotacao_id
     ORDER BY c.created_at DESC LIMIT 1;
  END IF;

  IF _contrato_id IS NULL AND NEW.veiculo_id IS NOT NULL THEN
    SELECT c.id INTO _contrato_id
      FROM public.contratos c
     WHERE c.veiculo_id = NEW.veiculo_id
       AND c.status = 'assinado'
     ORDER BY c.created_at DESC LIMIT 1;
  END IF;

  PERFORM public.fn_auto_promover_cadastro_pos_operacao(_contrato_id, 'servicos:' || NEW.tipo::text);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_servico_promove_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_trg_servico_promove_cadastro IS
  'Auto-promoção de cadastro_aprovado SÓ via vistoria presencial técnica. Autovistoria do cliente (modalidade=autovistoria) jamais dispara — quebraria o fluxo canônico das 8 etapas. Bug histórico: causou auto-aprovação indevida (caso Andreia/Larissa em 15/05/2026).';

-- Frente 1b: mesma blindagem em agendamentos_base (mais seguro: exigir servico/instalacao presencial concluído na cadeia)
CREATE OR REPLACE FUNCTION public.fn_trg_agendamento_base_promove_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contrato_id uuid;
  _tem_presencial boolean;
BEGIN
  IF NEW.status::text <> 'realizado' THEN
    RETURN NEW;
  END IF;
  IF NEW.cotacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só promove se houver servico/instalacao PRESENCIAL terminal na cadeia
  SELECT EXISTS (
    SELECT 1 FROM public.servicos s
     WHERE s.cotacao_id = NEW.cotacao_id
       AND s.tipo IN ('instalacao','vistoria_entrada')
       AND s.status IN ('concluida','aprovada','aprovada_ressalvas')
       AND COALESCE(s.modalidade::text,'') <> 'autovistoria'
  ) INTO _tem_presencial;

  IF NOT _tem_presencial THEN
    RETURN NEW;
  END IF;

  SELECT c.id INTO _contrato_id
    FROM public.contratos c
   WHERE c.cotacao_id = NEW.cotacao_id
   ORDER BY c.created_at DESC LIMIT 1;

  PERFORM public.fn_auto_promover_cadastro_pos_operacao(_contrato_id, 'agendamento_base:realizado');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_agendamento_base_promove_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

-- =====================================================================
-- Frente 2: saneamento dos contratos contaminados (fingerprint aprovado_por IS NULL)
-- =====================================================================
DO $$
DECLARE
  _r record;
  _qtd int := 0;
BEGIN
  FOR _r IN
    SELECT c.id, c.numero, c.cliente_nome, c.cotacao_id
      FROM public.contratos c
     WHERE c.cadastro_aprovado = true
       AND c.aprovado_por IS NULL
       AND c.aprovado_em IS NOT NULL
       AND c.status = 'assinado'
       AND NOT EXISTS (
         SELECT 1 FROM public.instalacoes i
          WHERE i.contrato_id = c.id AND i.status = 'concluida'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.servicos s
          WHERE (s.contrato_id = c.id OR s.cotacao_id = c.cotacao_id)
            AND s.tipo IN ('instalacao','vistoria_entrada')
            AND s.status IN ('concluida','aprovada','aprovada_ressalvas')
            AND COALESCE(s.modalidade::text,'') <> 'autovistoria'
       )
  LOOP
    -- formato exigido pelo trg_protege_cadastro_aprovado
    UPDATE public.contratos
       SET cadastro_aprovado = false,
           aprovado_em = NULL,
           aprovado_por = NULL,
           updated_at = now()
     WHERE id = _r.id;

    INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
    VALUES (
      'editar', 'contratos', 'contratos', _r.id,
      format(
        'saneamento_cadastro_auto_promovido_indevidamente: contrato %s (%s) tinha cadastro_aprovado=true sem aprovador humano. Fingerprint: aprovado_por IS NULL + única evidência era servico/vistoria modalidade=autovistoria. Devolvido para a fila do Cadastro.',
        _r.numero, _r.cliente_nome
      )
    );

    -- Recompute do status_contratacao da cotação
    BEGIN
      PERFORM public.recompute_cotacao_status_contratacao(_r.cotacao_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[saneamento] recompute falhou para cot %: %', _r.cotacao_id, SQLERRM;
    END;

    _qtd := _qtd + 1;
  END LOOP;

  RAISE NOTICE '[saneamento_cadastro_auto_promovido] % contratos revertidos para a fila do Cadastro', _qtd;
END $$;
