-- RPC canônica: detectar tipo de veículo (carro|moto) por marca+modelo,
-- sem exigir veiculo_id. Replica a sequência usada em fn_veiculo_precisa_rastreador:
--   1) marcas_modelos.tipo_veiculo (catálogo)
--   2) configuracoes.marcas_exclusivas_moto (CSV/JSON) — override quando catálogo
--      diz "carro" ou está ausente
--   3) regex de keywords no modelo (rede de segurança)
-- Default: 'carro'.

CREATE OR REPLACE FUNCTION public.fn_detectar_tipo_veiculo(_marca text, _modelo text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_marca_norm  text;
  v_modelo_norm text;
  v_catalogo_tipo text;
  v_marcas_moto text;
BEGIN
  v_marca_norm  := upper(trim(coalesce(_marca,  '')));
  v_modelo_norm := upper(trim(coalesce(_modelo, '')));

  IF v_marca_norm = '' AND v_modelo_norm = '' THEN
    RETURN 'carro';
  END IF;

  -- 1) Catálogo marcas_modelos.tipo_veiculo
  IF v_marca_norm <> '' AND v_modelo_norm <> '' THEN
    SELECT lower(tipo_veiculo) INTO v_catalogo_tipo
      FROM public.marcas_modelos
     WHERE upper(trim(marca))  = v_marca_norm
       AND upper(trim(modelo)) = v_modelo_norm
     LIMIT 1;
    IF v_catalogo_tipo = 'moto' THEN
      RETURN 'moto';
    END IF;
  END IF;

  -- 2) Marcas exclusivas de moto em configuracoes
  BEGIN
    SELECT valor::text INTO v_marcas_moto
      FROM public.configuracoes
     WHERE chave='marcas_exclusivas_moto' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;

  IF v_marcas_moto IS NOT NULL AND v_marca_norm <> '' THEN
    IF position(v_marca_norm IN upper(v_marcas_moto)) > 0 THEN
      RETURN 'moto';
    END IF;
  END IF;

  -- 3) Keywords no modelo (regex idêntica à de fn_veiculo_precisa_rastreador)
  IF v_modelo_norm <> '' THEN
    IF lower(' '||v_modelo_norm||' ') ~ '\y(cg|fan|titan|biz|pop|bros|xre|cb|hornet|fazer|ybr|factor|xtz|crf|cbr|gsr|gsx|cgr|ttr|nxr|cb300|cb500|pcx|nmax|burgman|sh ?150|elite ?125|adv ?150|nh ?125|kasinski|harley)\y' THEN
      RETURN 'moto';
    END IF;
  END IF;

  RETURN 'carro';
END;
$function$;

COMMENT ON FUNCTION public.fn_detectar_tipo_veiculo(text, text) IS
  'Fonte canônica de detecção carro|moto por marca+modelo. Sequência: marcas_modelos.tipo_veiculo → configuracoes.marcas_exclusivas_moto → regex de keywords. Mesma lógica usada em fn_veiculo_precisa_rastreador. Default: carro.';

GRANT EXECUTE ON FUNCTION public.fn_detectar_tipo_veiculo(text, text)
  TO anon, authenticated, service_role;

-- Refactor: fn_veiculo_precisa_rastreador passa a delegar detecção do tipo
-- à nova RPC, preservando: Diesel sempre exige, FIPE 0/null exige (fail-safe),
-- limites por configuracoes.
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
  v_is_moto boolean := false;
BEGIN
  IF _veiculo_id IS NULL THEN RETURN true; END IF;

  SELECT v.valor_fipe, v.combustivel, v.marca, v.modelo
    INTO v_fipe, v_combustivel, v_marca, v_modelo
  FROM public.veiculos v WHERE v.id = _veiculo_id;

  IF NOT FOUND THEN RETURN true; END IF;

  -- 1) Diesel sempre exige rastreador.
  IF v_combustivel ILIKE '%diesel%' THEN RETURN true; END IF;

  -- Limites por configuracoes (fallback se ausente).
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

  -- 2) Tipo via RPC canônica.
  v_is_moto := (public.fn_detectar_tipo_veiculo(v_marca, v_modelo) = 'moto');

  -- 3) FIPE ausente/zero → fail-safe: exige rastreador.
  IF coalesce(v_fipe, 0) <= 0 THEN RETURN true; END IF;

  -- 4) Limite mínimo conforme tipo.
  IF v_is_moto THEN
    RETURN v_fipe >= v_fipe_min_moto;
  ELSE
    RETURN v_fipe >= v_fipe_min_carro;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.fn_veiculo_precisa_rastreador(uuid) IS
  'Decide se um veículo precisa de rastreador. Delega detecção moto/carro à fn_detectar_tipo_veiculo. Diesel sempre exige; FIPE 0/null fail-safe exige.';