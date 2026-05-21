CREATE OR REPLACE FUNCTION public.fn_cancelar_associado_se_orfao(_associado_id uuid, _motivo text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contratos int;
  v_veiculos int;
  v_status_atual text;
BEGIN
  IF _associado_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT status::text INTO v_status_atual FROM associados WHERE id = _associado_id;
  IF v_status_atual IS NULL OR v_status_atual IN ('cancelado','recusado') THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_contratos
    FROM contratos
   WHERE associado_id = _associado_id
     AND status IN ('ativo','assinado','pendente');

  SELECT count(*) INTO v_veiculos
    FROM veiculos
   WHERE associado_id = _associado_id
     AND status::text NOT IN ('cancelado','vendido','transferido');

  IF v_contratos = 0 AND v_veiculos = 0 THEN
    UPDATE associados
       SET status = 'cancelado', updated_at = now()
     WHERE id = _associado_id;

    INSERT INTO associados_historico(associado_id, tipo, descricao, status_anterior, status_novo, motivo)
      VALUES (_associado_id, 'status_alterado',
              'Cancelado automaticamente (órfão pós-troca de titularidade): ' || COALESCE(_motivo,''),
              v_status_atual, 'cancelado', _motivo);
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_inativar_associado_se_orfao(_associado_id uuid, _motivo text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.fn_cancelar_associado_se_orfao(_associado_id, _motivo);
$$;

DO $$
DECLARE
  r record;
  v_ok boolean;
BEGIN
  FOR r IN
    SELECT a.id, a.nome
      FROM associados a
     WHERE a.status = 'ativo'
       AND EXISTS (SELECT 1 FROM solicitacoes_troca_titularidade stt
                     WHERE stt.associado_antigo_id = a.id AND stt.status = 'efetivada')
       AND NOT EXISTS (SELECT 1 FROM veiculos v
                         WHERE v.associado_id = a.id
                           AND v.status::text NOT IN ('cancelado','vendido','transferido'))
       AND NOT EXISTS (SELECT 1 FROM contratos c
                         WHERE c.associado_id = a.id
                           AND c.status IN ('ativo','assinado','pendente'))
  LOOP
    SELECT public.fn_cancelar_associado_se_orfao(
      r.id,
      'Saneamento 2026-05-21: troca de titularidade efetivada — antigo titular sem vínculos restantes (bug fn_inativar_associado_se_orfao corrigido)'
    ) INTO v_ok;
    RAISE NOTICE 'Saneamento órfão troca: % (%) -> %', r.nome, r.id, v_ok;
  END LOOP;
END $$;