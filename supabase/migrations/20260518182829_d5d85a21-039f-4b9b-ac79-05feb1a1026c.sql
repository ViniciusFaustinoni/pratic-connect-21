
-- =====================================================================
-- 1) Fix fn_validar_campos_ativacao: dispensar RENAVAM e placa-placeholder em 0KM
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_validar_campos_ativacao(_associado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc record;
  v_veic  record;
  v_faltando text[] := ARRAY[]::text[];
  v_is_zero_km boolean := false;
  v_renavam_norm text;
BEGIN
  SELECT id, cpf, email, telefone, contrato_id, status
    INTO v_assoc
    FROM public.associados
   WHERE id = _associado_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valido', false,
      'motivo', 'associado_nao_encontrado',
      'campos_faltando', jsonb_build_array('associado')
    );
  END IF;

  IF v_assoc.cpf IS NULL OR length(btrim(v_assoc.cpf)) < 11 THEN
    v_faltando := array_append(v_faltando, 'cpf');
  END IF;
  IF v_assoc.email IS NULL OR length(btrim(v_assoc.email)) = 0 THEN
    v_faltando := array_append(v_faltando, 'email');
  END IF;
  IF v_assoc.telefone IS NULL OR length(btrim(v_assoc.telefone)) < 10 THEN
    v_faltando := array_append(v_faltando, 'telefone');
  END IF;

  SELECT v.id, v.placa, v.chassi, v.renavam, v.aguardando_placa_definitiva
    INTO v_veic
    FROM public.veiculos v
   WHERE v.associado_id = _associado_id
   ORDER BY v.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    v_faltando := array_append(v_faltando, 'veiculo');
  ELSE
    v_is_zero_km := COALESCE(v_veic.aguardando_placa_definitiva, false)
                 OR (v_veic.placa IS NOT NULL AND (v_veic.placa ILIKE '0KM%' OR v_veic.placa ILIKE 'ZZZ%'));

    IF v_veic.chassi IS NULL OR length(btrim(v_veic.chassi)) < 17 THEN
      v_faltando := array_append(v_faltando, 'chassi');
    END IF;

    IF NOT v_is_zero_km THEN
      IF v_veic.placa IS NULL OR length(btrim(v_veic.placa)) < 7 THEN
        v_faltando := array_append(v_faltando, 'placa');
      END IF;
    END IF;

    IF NOT v_is_zero_km THEN
      v_renavam_norm := regexp_replace(COALESCE(v_veic.renavam, ''), '\D', '', 'g');
      IF v_renavam_norm = '' OR v_renavam_norm ~ '^0+$' OR length(v_renavam_norm) < 9 THEN
        v_faltando := array_append(v_faltando, 'renavam');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valido', (array_length(v_faltando, 1) IS NULL),
    'campos_faltando', to_jsonb(v_faltando),
    'is_zero_km', v_is_zero_km
  );
END;
$$;

COMMENT ON FUNCTION public.fn_validar_campos_ativacao(uuid) IS
'Valida campos obrigatórios para ativação. RENAVAM e placa real são dispensados quando o veículo é 0KM (aguardando_placa_definitiva=true ou placa começa com 0KM/ZZZ). Chassi sempre obrigatório.';

-- =====================================================================
-- 2) Saneamento Lote A — 5 contratos órfãos promovidos por bug do trigger
-- =====================================================================
DO $$
DECLARE
  v_orphans uuid[] := ARRAY[
    '5be6bc5d-3e76-4fdf-ba33-9b33af058f35'::uuid,
    'ea20ff65-12c1-40a0-842d-4c58fc3387dd'::uuid,
    'e05f55e9-19ad-42f5-b4f5-8a739872de27'::uuid,
    '40f378f0-168d-4cd8-8a67-8f5a347f66ef'::uuid,
    '8641bf11-f0ff-4b8b-954f-6e58ad49c456'::uuid
  ];
  v_contrato_id uuid;
  v_associado_id uuid;
  v_veiculo_id uuid;
BEGIN
  FOREACH v_contrato_id IN ARRAY v_orphans LOOP
    SELECT c.associado_id, c.veiculo_id INTO v_associado_id, v_veiculo_id
    FROM public.contratos c WHERE c.id = v_contrato_id;

    UPDATE public.contratos
       SET status            = 'assinado',
           cadastro_aprovado = false,
           aprovado_por      = NULL,
           aprovado_em       = NULL,
           updated_at        = now()
     WHERE id = v_contrato_id;

    UPDATE public.veiculos
       SET status     = 'instalacao_pendente',
           updated_at = now()
     WHERE id = v_veiculo_id;

    UPDATE public.associados
       SET status     = 'em_analise',
           updated_at = now()
     WHERE id = v_associado_id;

    INSERT INTO public.integration_retry_queue
      (integration, operation, payload, correlation_id, status, next_attempt_at)
    VALUES
      ('sga', 'alterar_situacao_associado_pendente',
       jsonb_build_object('associado_id', v_associado_id, 'situacao', 3,
                          'motivo', 'saneamento_orfao_pre_fix_20260518_autovistoria_promove_cadastro'),
       v_associado_id::text, 'pending', now()),
      ('sga', 'alterar_situacao_veiculo_pendente',
       jsonb_build_object('veiculo_id', v_veiculo_id, 'situacao', 3,
                          'motivo', 'saneamento_orfao_pre_fix_20260518_autovistoria_promove_cadastro'),
       v_veiculo_id::text, 'pending', now());
  END LOOP;
END $$;
