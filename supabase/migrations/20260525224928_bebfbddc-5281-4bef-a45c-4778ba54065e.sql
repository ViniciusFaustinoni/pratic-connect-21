-- Remove a assinatura ANTIGA de realocar_servico que ficou órfã após
-- a migration 20260525142831 ter criado a nova versão com ordem de
-- parâmetros diferente. As duas funções têm a mesma aridade (9 params)
-- e nomes coincidentes, então o Postgres devolvia 42883
-- ("could not choose the best candidate function") quando o front
-- chamava via supabase.rpc('realocar_servico', { _servico_id, _destino, ... }).
--
-- A assinatura mantida é a nova:
--   (_servico_id uuid, _destino text, _motivo text, _categoria text,
--    _profissional_id uuid, _rota_id uuid, _oficina_id uuid,
--    _nova_data date, _novo_periodo text)
--
-- Os wrappers liberar_servico_para_reatribuicao / reatribuir_servico_admin
-- chamam via named params e ficam compatíveis automaticamente.

DROP FUNCTION IF EXISTS public.realocar_servico(
  uuid, text, text, text, date, text, uuid, uuid, uuid
);

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'realocar_servico'
    AND pronamespace = 'public'::regnamespace;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente 1 realocar_servico após DROP, encontrado %', v_count;
  END IF;
END$$;