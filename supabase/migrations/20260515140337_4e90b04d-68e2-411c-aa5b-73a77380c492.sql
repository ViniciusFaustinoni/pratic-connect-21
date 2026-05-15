-- Reconciliação Cadastro→Monitoramento. Quando o operacional (vistoria-base,
-- serviço de vistoria/instalação ou instalação) é concluído antes do Cadastro
-- aprovar manualmente, o contrato fica preso na fila do Cadastro porque o
-- Monitoramento exige cadastro_aprovado=true. Esta migration auto-promove
-- esses casos para o Monitoramento com auditoria.

CREATE OR REPLACE FUNCTION public.fn_auto_promover_cadastro_pos_operacao(
  _contrato_id uuid,
  _origem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _atualizados int;
BEGIN
  IF _contrato_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.contratos
     SET cadastro_aprovado = true,
         aprovado_em = COALESCE(aprovado_em, now()),
         updated_at = now()
   WHERE id = _contrato_id
     AND status = 'assinado'
     AND cadastro_aprovado = false;

  GET DIAGNOSTICS _atualizados = ROW_COUNT;

  IF _atualizados > 0 THEN
    INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
    VALUES (
      'aprovar',
      'contratos',
      'contratos',
      _contrato_id,
      format(
        'Cadastro auto-aprovado por avanço operacional (origem=%s). Vistoria/serviço/agendamento concluiu antes da aprovação manual; liberando contrato para a fila do Monitoramento.',
        _origem
      )
    );
  END IF;
END;
$$;

-- Trigger em servicos
CREATE OR REPLACE FUNCTION public.fn_trg_servico_promove_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contrato_id uuid;
BEGIN
  IF NEW.status::text NOT IN ('concluida','aprovada','aprovada_ressalvas') THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo::text NOT IN ('instalacao','vistoria_entrada') THEN
    RETURN NEW;
  END IF;

  _contrato_id := NEW.contrato_id;

  IF _contrato_id IS NULL AND NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT v.contrato_id INTO _contrato_id
      FROM public.vistorias v
     WHERE v.id = NEW.vistoria_origem_id;
  END IF;

  IF _contrato_id IS NULL AND NEW.cotacao_id IS NOT NULL THEN
    SELECT c.id INTO _contrato_id
      FROM public.contratos c
     WHERE c.cotacao_id = NEW.cotacao_id
     ORDER BY c.created_at DESC
     LIMIT 1;
  END IF;

  IF _contrato_id IS NULL AND NEW.veiculo_id IS NOT NULL THEN
    SELECT c.id INTO _contrato_id
      FROM public.contratos c
     WHERE c.veiculo_id = NEW.veiculo_id
       AND c.status = 'assinado'
     ORDER BY c.created_at DESC
     LIMIT 1;
  END IF;

  PERFORM public.fn_auto_promover_cadastro_pos_operacao(_contrato_id, 'servicos:' || NEW.tipo::text);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_servico_promove_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servico_promove_cadastro ON public.servicos;
CREATE TRIGGER trg_servico_promove_cadastro
  AFTER INSERT OR UPDATE OF status ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_servico_promove_cadastro();

-- Trigger em agendamentos_base
CREATE OR REPLACE FUNCTION public.fn_trg_agendamento_base_promove_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contrato_id uuid;
BEGIN
  IF NEW.status::text <> 'realizado' THEN
    RETURN NEW;
  END IF;
  IF NEW.cotacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.id INTO _contrato_id
    FROM public.contratos c
   WHERE c.cotacao_id = NEW.cotacao_id
   ORDER BY c.created_at DESC
   LIMIT 1;

  PERFORM public.fn_auto_promover_cadastro_pos_operacao(_contrato_id, 'agendamento_base:realizado');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_agendamento_base_promove_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_base_promove_cadastro ON public.agendamentos_base;
CREATE TRIGGER trg_agendamento_base_promove_cadastro
  AFTER INSERT OR UPDATE OF status ON public.agendamentos_base
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_agendamento_base_promove_cadastro();

-- Trigger em instalacoes
CREATE OR REPLACE FUNCTION public.fn_trg_instalacao_promove_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text <> 'concluida' THEN
    RETURN NEW;
  END IF;
  PERFORM public.fn_auto_promover_cadastro_pos_operacao(NEW.contrato_id, 'instalacoes:concluida');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_instalacao_promove_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instalacao_promove_cadastro ON public.instalacoes;
CREATE TRIGGER trg_instalacao_promove_cadastro
  AFTER INSERT OR UPDATE OF status ON public.instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_instalacao_promove_cadastro();

-- Backfill imediato
WITH alvos AS (
  SELECT DISTINCT c.id
    FROM public.contratos c
   WHERE c.status = 'assinado'
     AND c.cadastro_aprovado = false
     AND (
       EXISTS (SELECT 1 FROM public.agendamentos_base ab WHERE ab.cotacao_id = c.cotacao_id AND ab.status = 'realizado')
       OR EXISTS (
         SELECT 1 FROM public.servicos s
          WHERE (s.contrato_id = c.id OR s.cotacao_id = c.cotacao_id OR s.veiculo_id = c.veiculo_id)
            AND s.tipo IN ('instalacao','vistoria_entrada')
            AND s.status IN ('concluida','aprovada','aprovada_ressalvas')
       )
       OR EXISTS (SELECT 1 FROM public.instalacoes i WHERE i.contrato_id = c.id AND i.status = 'concluida')
     )
)
SELECT public.fn_auto_promover_cadastro_pos_operacao(a.id, 'backfill:reconciliacao')
  FROM alvos a;
