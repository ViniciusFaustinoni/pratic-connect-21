
CREATE OR REPLACE FUNCTION public.resolver_codigo_sga_combustivel(p_combustivel TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c TEXT;
BEGIN
  IF p_combustivel IS NULL OR btrim(p_combustivel) = '' THEN RETURN NULL; END IF;
  c := upper(btrim(p_combustivel));

  IF c LIKE '%TETRA%' THEN RETURN 6; END IF;
  IF c LIKE '%BIO%GAS%' OR c LIKE '%BIOGAS%' OR c LIKE '%BIO-GAS%' THEN RETURN 5; END IF;
  IF c LIKE '%DIESEL%' THEN RETURN 4; END IF;

  -- Flex: contém "/" (multi-combustível) → SGA = 1 (Flex)
  -- Cobre: "GAS/ALC/GN", "GASOLINA/ALCOOL", "GASOLINA/ALCOOL/GAS NATURAL", etc.
  IF c LIKE '%/%' THEN RETURN 1; END IF;
  IF c = 'FLEX' OR c LIKE '%FLEX%' OR c LIKE '%BICOMB%' THEN RETURN 1; END IF;

  -- Gasolina pura
  IF c = 'GASOLINA' OR c LIKE 'GASOLINA%' OR c = 'GAS' THEN RETURN 2; END IF;
  -- Etanol / Álcool
  IF c = 'ETANOL' OR c = 'ALCOOL' OR c = 'ÁLCOOL' OR c = 'ALC'
     OR c LIKE '%ETANOL%' OR c LIKE '%ALCOOL%' OR c LIKE '%ÁLCOOL%' THEN RETURN 3; END IF;

  -- GNV / Elétrico / Híbrido não existem no SGA → bloqueia
  RETURN NULL;
END;
$$;

-- Re-backfill seguro
DO $$
DECLARE
  v_id UUID;
  v_combustivel TEXT;
  v_codigo INTEGER;
  v_skipped INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  FOR v_id, v_combustivel IN
    SELECT id, combustivel FROM public.veiculos
     WHERE combustivel IS NOT NULL AND codigo_sga_combustivel IS NULL
  LOOP
    v_codigo := public.resolver_codigo_sga_combustivel(v_combustivel);
    IF v_codigo IS NOT NULL THEN
      BEGIN
        UPDATE public.veiculos SET codigo_sga_combustivel = v_codigo WHERE id = v_id;
        v_updated := v_updated + 1;
      EXCEPTION WHEN OTHERS THEN v_skipped := v_skipped + 1;
      END;
    END IF;
  END LOOP;
  RAISE NOTICE 'Re-backfill: atualizados=%, ignorados=%', v_updated, v_skipped;
END $$;
