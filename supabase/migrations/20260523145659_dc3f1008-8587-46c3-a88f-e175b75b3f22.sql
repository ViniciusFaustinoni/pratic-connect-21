CREATE OR REPLACE FUNCTION public.fn_veiculo_precisa_rastreador(_veiculo_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fipe numeric;
  v_combustivel text;
  v_marca text;
  v_modelo text;
  v_fipe_min_carro numeric := 30000;
  v_fipe_min_moto  numeric := 9000;
  v_marcas_moto text;
  v_is_moto boolean := false;
  v_marca_norm text;
  v_modelo_norm text;
  v_catalogo_tipo text;
BEGIN
  IF _veiculo_id IS NULL THEN RETURN true; END IF;

  SELECT v.valor_fipe, v.combustivel, v.marca, v.modelo
    INTO v_fipe, v_combustivel, v_marca, v_modelo
  FROM public.veiculos v WHERE v.id = _veiculo_id;

  IF NOT FOUND THEN RETURN true; END IF;

  -- 1) Diesel sempre exige rastreador.
  IF v_combustivel ILIKE '%diesel%' THEN RETURN true; END IF;

  -- Configurações (com fallback se chaves faltarem).
  BEGIN
    SELECT (valor)::numeric INTO v_fipe_min_carro
      FROM public.configuracoes
     WHERE chave='operacional_fipe_minimo_rastreador' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    SELECT (valor)::numeric INTO v_fipe_min_moto
      FROM public.configuracoes
     WHERE chave='operacional_fipe_minimo_rastreador_moto' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    SELECT valor::text INTO v_marcas_moto
      FROM public.configuracoes
     WHERE chave='marcas_exclusivas_moto' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;

  v_marca_norm  := upper(trim(coalesce(v_marca,  '')));
  v_modelo_norm := upper(trim(coalesce(v_modelo, '')));

  -- 2) FONTE CANÔNICA: marcas_modelos.tipo_veiculo (mesmo critério usado
  --    em finalizar-autovistoria-cotacao e escopoAnaliseCadastro).
  IF v_marca_norm <> '' AND v_modelo_norm <> '' THEN
    SELECT lower(tipo_veiculo) INTO v_catalogo_tipo
      FROM public.marcas_modelos
     WHERE upper(trim(marca))  = v_marca_norm
       AND upper(trim(modelo)) = v_modelo_norm
     LIMIT 1;

    IF v_catalogo_tipo = 'moto' THEN
      v_is_moto := true;
    END IF;
  END IF;

  -- 3) OVERRIDE: quando catálogo está ausente OU diz 'carro' (caso conhecido
  --    de motos Honda/Yamaha/BMW classificadas como 'carro' no catálogo),
  --    aplicar marcas exclusivas de moto + keywords de modelo como rede.
  IF NOT v_is_moto THEN
    -- 3a) Marca exclusiva de moto (CSV/JSON em configuracoes).
    IF v_marcas_moto IS NOT NULL AND v_marca_norm <> '' THEN
      IF position(v_marca_norm IN upper(v_marcas_moto)) > 0 THEN
        v_is_moto := true;
      END IF;
    END IF;

    -- 3b) Keyword de modelo (regex com \y nas duas bordas — \m só casa início
    --     de palavra, então modelos terminando em número como "ELITE 125" /
    --     "ADV 150" / "NH 125" / "SH 150" exigiam \M ou \y no final).
    IF NOT v_is_moto AND v_modelo IS NOT NULL THEN
      IF lower(' '||v_modelo||' ') ~ '\y(cg|fan|titan|biz|pop|bros|xre|cb|hornet|fazer|ybr|factor|xtz|crf|cbr|gsr|gsx|cgr|ttr|nxr|cb300|cb500|pcx|nmax|burgman|sh ?150|elite ?125|adv ?150|nh ?125|kasinski|harley)\y' THEN
        v_is_moto := true;
      END IF;
    END IF;
  END IF;

  -- 4) FIPE ausente/zero → fail-safe: exige rastreador.
  IF coalesce(v_fipe, 0) <= 0 THEN RETURN true; END IF;

  -- 5) Limite mínimo conforme tipo.
  IF v_is_moto THEN
    RETURN v_fipe >= v_fipe_min_moto;
  ELSE
    RETURN v_fipe >= v_fipe_min_carro;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.fn_veiculo_precisa_rastreador(uuid) IS
  'Decide se um veículo precisa de rastreador. Fonte canônica: marcas_modelos.tipo_veiculo, com override por marcas_exclusivas_moto + regex de keyword quando catálogo ausente ou diz carro. Diesel sempre exige.';