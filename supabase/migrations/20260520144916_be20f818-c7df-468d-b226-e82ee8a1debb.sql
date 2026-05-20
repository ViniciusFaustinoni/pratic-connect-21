CREATE OR REPLACE FUNCTION public.fn_guard_autovistoria_servico_disjunto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_autovistoria boolean := false;
BEGIN
  -- Detecta se o serviço é de autovistoria (via vistoria origem)
  IF NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT (modalidade = 'autovistoria') INTO v_is_autovistoria
    FROM public.vistorias
    WHERE id = NEW.vistoria_origem_id;
  END IF;

  IF COALESCE(v_is_autovistoria, false) = false THEN
    RETURN NEW;
  END IF;

  -- 1) Serviço de autovistoria NUNCA pode vincular instalacao_origem_id
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    RAISE EXCEPTION 'Serviço de autovistoria não pode ser vinculado a instalação física (instalacao_origem_id=%).', NEW.instalacao_origem_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2) Status permitidos para serviço de autovistoria
  --    Inclui 'concluida' (sub-FIPE após Cadastro aprovar) e 'agendada' (materialização inicial)
  IF NEW.status NOT IN ('em_analise','aprovada','reprovada','cancelada','concluida','agendada') THEN
    RAISE EXCEPTION 'Status % inválido para serviço de autovistoria (permitidos: em_analise, aprovada, reprovada, cancelada, concluida, agendada).', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;