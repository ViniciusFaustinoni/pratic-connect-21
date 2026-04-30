
-- 1. Corrigir hinova_mapeamentos
UPDATE public.hinova_mapeamentos SET codigo_hinova = 1, descricao = 'FLEX', ativo = true WHERE tipo = 'combustivel' AND codigo_local = 'flex';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 2, descricao = 'GASOLINA', ativo = true WHERE tipo = 'combustivel' AND codigo_local = 'gasolina';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 3, descricao = 'ETANOL', ativo = true WHERE tipo = 'combustivel' AND codigo_local IN ('etanol','alcool');
UPDATE public.hinova_mapeamentos SET codigo_hinova = 4, descricao = 'DIESEL', ativo = true WHERE tipo = 'combustivel' AND codigo_local = 'diesel';

INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
SELECT 'combustivel', 'biogas', 5, 'BIO-GAS', true
WHERE NOT EXISTS (SELECT 1 FROM public.hinova_mapeamentos WHERE tipo='combustivel' AND codigo_local='biogas');

INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
SELECT 'combustivel', 'tetrafuel', 6, 'TETRA-FUEL', true
WHERE NOT EXISTS (SELECT 1 FROM public.hinova_mapeamentos WHERE tipo='combustivel' AND codigo_local='tetrafuel');

UPDATE public.hinova_mapeamentos SET ativo = false
WHERE tipo = 'combustivel' AND codigo_local IN ('gnv','eletrico','hibrido');

-- 2. Coluna em veiculos
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS codigo_sga_combustivel INTEGER;

COMMENT ON COLUMN public.veiculos.codigo_sga_combustivel IS 'Código SGA Hinova do combustível (1=Flex, 2=Gasolina, 3=Etanol, 4=Diesel, 5=Bio-gás, 6=Tetra-fuel). Auto-preenchido por trigger.';

-- 3. Função pura de normalização
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
  IF c = 'FLEX' OR c LIKE '%FLEX%' OR c LIKE '%BICOMB%' THEN RETURN 1; END IF;
  IF (c LIKE '%/%') AND (c LIKE '%GASOLINA%' OR c LIKE '%ALCOOL%' OR c LIKE '%ÁLCOOL%' OR c LIKE '%ETANOL%') THEN RETURN 1; END IF;
  IF c = 'GASOLINA' OR c LIKE 'GASOLINA%' THEN RETURN 2; END IF;
  IF c = 'ETANOL' OR c = 'ALCOOL' OR c = 'ÁLCOOL' OR c LIKE '%ETANOL%' OR c LIKE '%ALCOOL%' OR c LIKE '%ÁLCOOL%' THEN RETURN 3; END IF;

  RETURN NULL;
END;
$$;

-- 4. Trigger
CREATE OR REPLACE FUNCTION public.trg_set_codigo_sga_combustivel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.combustivel IS DISTINCT FROM OLD.combustivel THEN
    NEW.codigo_sga_combustivel := public.resolver_codigo_sga_combustivel(NEW.combustivel);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_veiculos_codigo_sga_combustivel ON public.veiculos;
CREATE TRIGGER trg_veiculos_codigo_sga_combustivel
BEFORE INSERT OR UPDATE OF combustivel ON public.veiculos
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_codigo_sga_combustivel();

-- 5. Backfill seguro: pula linhas que falham em outras constraints (ex.: chassi legado inválido)
DO $$
DECLARE
  v_id UUID;
  v_combustivel TEXT;
  v_codigo INTEGER;
  v_skipped INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  FOR v_id, v_combustivel IN
    SELECT id, combustivel
      FROM public.veiculos
     WHERE combustivel IS NOT NULL
       AND codigo_sga_combustivel IS NULL
  LOOP
    v_codigo := public.resolver_codigo_sga_combustivel(v_combustivel);
    IF v_codigo IS NOT NULL THEN
      BEGIN
        UPDATE public.veiculos
           SET codigo_sga_combustivel = v_codigo
         WHERE id = v_id;
        v_updated := v_updated + 1;
      EXCEPTION WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
      END;
    END IF;
  END LOOP;
  RAISE NOTICE 'Backfill combustível SGA: atualizados=%, ignorados=%', v_updated, v_skipped;
END $$;
