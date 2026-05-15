-- Reverter triggers de auto-promoção de Cadastro pós-operacional.
-- A regra mestra exige aprovação MANUAL do Cadastro antes de qualquer
-- avanço operacional. Auto-promover mascarava o defeito de fluxo.
-- Substituímos por uma função de ALERTA que apenas registra em
-- logs_auditoria quando uma vistoria/instalação concluiu com o
-- contrato ainda pendente de Cadastro — para o time investigar.

DROP TRIGGER IF EXISTS trg_servico_promove_cadastro ON public.servicos;
DROP TRIGGER IF EXISTS trg_agendamento_base_promove_cadastro ON public.agendamentos_base;
DROP TRIGGER IF EXISTS trg_instalacao_promove_cadastro ON public.instalacoes;

DROP FUNCTION IF EXISTS public.fn_trg_servico_promove_cadastro() CASCADE;
DROP FUNCTION IF EXISTS public.fn_trg_agendamento_base_promove_cadastro() CASCADE;
DROP FUNCTION IF EXISTS public.fn_trg_instalacao_promove_cadastro() CASCADE;
DROP FUNCTION IF EXISTS public.fn_auto_promover_cadastro_pos_operacao(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.fn_alerta_cadastro_pendente_pos_operacao(
  _contrato_id uuid,
  _origem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pendente boolean;
BEGIN
  IF _contrato_id IS NULL THEN
    RETURN;
  END IF;

  SELECT (status = 'assinado' AND cadastro_aprovado = false)
    INTO _pendente
    FROM public.contratos
   WHERE id = _contrato_id;

  IF COALESCE(_pendente, false) THEN
    INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
    VALUES (
      'alerta',
      'contratos',
      'contratos',
      _contrato_id,
      format(
        'ALERTA fluxo: avanço operacional (%s) concluiu antes da aprovação manual do Cadastro. Contrato deve ser revisado pela equipe — Cadastro nunca deve ser pulado.',
        _origem
      )
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trg_servico_alerta_cadastro()
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

  PERFORM public.fn_alerta_cadastro_pendente_pos_operacao(_contrato_id, 'servicos:' || NEW.tipo::text);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_servico_alerta_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_servico_alerta_cadastro
  AFTER INSERT OR UPDATE OF status ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_servico_alerta_cadastro();

CREATE OR REPLACE FUNCTION public.fn_trg_instalacao_alerta_cadastro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text <> 'concluida' THEN
    RETURN NEW;
  END IF;
  PERFORM public.fn_alerta_cadastro_pendente_pos_operacao(NEW.contrato_id, 'instalacoes:concluida');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_trg_instalacao_alerta_cadastro] %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_instalacao_alerta_cadastro
  AFTER INSERT OR UPDATE OF status ON public.instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trg_instalacao_alerta_cadastro();