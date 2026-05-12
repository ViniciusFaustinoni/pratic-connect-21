CREATE OR REPLACE FUNCTION public.fn_inativar_associado_se_orfao(_associado_id uuid, _motivo text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contratos int;
  v_veiculos int;
  v_status_atual text;
BEGIN
  IF _associado_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status_atual FROM associados WHERE id = _associado_id;
  IF v_status_atual IS NULL OR v_status_atual = 'inativo' THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_contratos
    FROM contratos
   WHERE associado_id = _associado_id
     AND status IN ('ativo','assinado','pendente');

  SELECT count(*) INTO v_veiculos
    FROM veiculos
   WHERE associado_id = _associado_id
     AND COALESCE(status,'') NOT IN ('cancelado','vendido','transferido','inativo');

  IF v_contratos = 0 AND v_veiculos = 0 THEN
    UPDATE associados
       SET status = 'inativo', updated_at = now()
     WHERE id = _associado_id;

    INSERT INTO associados_historico(associado_id, tipo, descricao, status_anterior, status_novo, motivo)
      VALUES (_associado_id, 'inativado_orfao', _motivo, v_status_atual, 'inativo', _motivo);
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Backfill: inativar antigos proprietários de trocas já efetivadas que ficaram órfãos
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT associado_antigo_id
      FROM solicitacoes_troca_titularidade
     WHERE efetivada_em IS NOT NULL
       AND associado_antigo_id IS NOT NULL
  LOOP
    PERFORM public.fn_inativar_associado_se_orfao(
      r.associado_antigo_id,
      'Backfill — Troca de titularidade efetivada sem vínculos ativos restantes'
    );
  END LOOP;
END $$;