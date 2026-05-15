
-- =====================================================================
-- 1) Trigger anti-regressão: cadastro_aprovado=true não pode voltar para false
--    sem origem auditada (aprovar-proposta limbo OU diretor manual).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_protege_cadastro_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite o caminho do limbo (aprovar-proposta detecta cotação sem
  -- instalação/vistoria/agendamento real e zera aprovado_por + aprovado_em).
  -- Esse caminho SEMPRE limpa também aprovado_por/aprovado_em.
  IF OLD.cadastro_aprovado = true
     AND NEW.cadastro_aprovado = false
     AND (NEW.aprovado_por IS NOT NULL OR NEW.aprovado_em IS NOT NULL) THEN
    RAISE EXCEPTION
      'cadastro_aprovado_protegido: contrato % já foi aprovado pelo Cadastro e não pode voltar para a fila sem reset completo (aprovado_por/aprovado_em devem ser nulos).',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protege_cadastro_aprovado ON public.contratos;
CREATE TRIGGER trg_protege_cadastro_aprovado
  BEFORE UPDATE OF cadastro_aprovado ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protege_cadastro_aprovado();

-- =====================================================================
-- 2) Reconciliação automática de contratos travados em 'assinado' após
--    aprovação do Monitoramento (serviço aprovada há > 10 min mas
--    contrato ainda em 'assinado'). Lista os candidatos para o cron de
--    reconciliação chamar ativar-associado novamente (idempotente).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_listar_contratos_pos_monitoramento_travados()
RETURNS TABLE(contrato_id uuid, associado_id uuid, veiculo_id uuid, servico_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (c.id)
    c.id AS contrato_id,
    c.associado_id,
    c.veiculo_id,
    s.id AS servico_id
  FROM public.contratos c
  JOIN public.servicos s ON s.contrato_id = c.id
  WHERE c.status = 'assinado'
    AND c.cadastro_aprovado = true
    AND s.tipo IN ('instalacao','vistoria_entrada')
    AND s.status = 'aprovada'
    AND s.analisado_em IS NOT NULL
    AND s.analisado_em < now() - INTERVAL '10 minutes'
    AND c.associado_id IS NOT NULL
  ORDER BY c.id, s.analisado_em DESC;
$$;

COMMENT ON FUNCTION public.fn_listar_contratos_pos_monitoramento_travados IS
  'Lista contratos que o Monitoramento já aprovou (serviço.status=aprovada) há mais de 10 min mas que continuam em status=assinado — candidatos a re-invocar ativar-associado para promover a status=ativo (idempotente).';
