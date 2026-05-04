CREATE OR REPLACE FUNCTION public.fn_validar_campos_ativacao(_associado_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assoc record;
  v_veic  record;
  v_faltando text[] := ARRAY[]::text[];
  v_placa_norm text;
  v_renavam_norm text;
  v_chassi_norm text;
  v_is_zero_km boolean := false;
BEGIN
  SELECT id, cpf, email, telefone, contrato_id, status
    INTO v_assoc
    FROM public.associados
   WHERE id = _associado_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valido', false,
      'motivo', 'associado_nao_encontrado',
      'campos_faltando', jsonb_build_array('associado'),
      'is_zero_km', false
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

  SELECT v.id, v.placa, v.chassi, v.renavam
    INTO v_veic
    FROM public.veiculos v
   WHERE v.associado_id = _associado_id
   ORDER BY v.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    v_faltando := array_append(v_faltando, 'veiculo');
  ELSE
    v_placa_norm   := upper(btrim(coalesce(v_veic.placa, '')));
    v_renavam_norm := regexp_replace(coalesce(v_veic.renavam, ''), '\D', '', 'g');
    v_chassi_norm  := upper(btrim(coalesce(v_veic.chassi, '')));

    -- Detecção 0KM: placa placeholder OU renavam vazio/zeros
    v_is_zero_km := (
      v_placa_norm = ''
      OR v_placa_norm LIKE '0KM%'
      OR v_placa_norm LIKE 'SEM_PLACA%'
      OR v_placa_norm LIKE 'SEMPLACA%'
      OR v_placa_norm = 'NULL'
      OR v_renavam_norm = ''
      OR v_renavam_norm ~ '^0+$'
    );

    -- Chassi sempre obrigatório (regra do projeto: chassi é manual e canônico)
    IF length(v_chassi_norm) <> 17 THEN
      v_faltando := array_append(v_faltando, 'chassi');
    END IF;

    IF NOT v_is_zero_km THEN
      -- Veículo com documentação real: placa e renavam obrigatórios
      IF length(regexp_replace(v_placa_norm, '[^A-Z0-9]', '', 'g')) < 7 THEN
        v_faltando := array_append(v_faltando, 'placa');
      END IF;
      IF length(v_renavam_norm) < 9 THEN
        v_faltando := array_append(v_faltando, 'renavam');
      END IF;
    END IF;
    -- Veículo 0KM: placa e renavam dispensados; serão atualizados pós-emplacamento.
  END IF;

  RETURN jsonb_build_object(
    'valido', (array_length(v_faltando, 1) IS NULL),
    'campos_faltando', to_jsonb(v_faltando),
    'is_zero_km', v_is_zero_km
  );
END;
$function$;