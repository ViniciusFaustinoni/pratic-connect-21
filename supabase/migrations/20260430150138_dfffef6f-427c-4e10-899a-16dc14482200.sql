
-- 1. Corrigir hinova_mapeamentos para cores
UPDATE public.hinova_mapeamentos SET codigo_hinova = 1,  descricao = 'PRETO',    ativo = true WHERE tipo='cor' AND codigo_local='preto';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 2,  descricao = 'BRANCA',   ativo = true WHERE tipo='cor' AND codigo_local='branco';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 3,  descricao = 'AZUL',     ativo = true WHERE tipo='cor' AND codigo_local='azul';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 4,  descricao = 'VERMELHO', ativo = true WHERE tipo='cor' AND codigo_local='vermelho';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 5,  descricao = 'VERDE',    ativo = true WHERE tipo='cor' AND codigo_local='verde';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 6,  descricao = 'CINZA',    ativo = true WHERE tipo='cor' AND codigo_local='cinza';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 7,  descricao = 'BEGE',     ativo = true WHERE tipo='cor' AND codigo_local='bege';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 8,  descricao = 'AMARELO',  ativo = true WHERE tipo='cor' AND codigo_local='amarelo';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 9,  descricao = 'PRATA',    ativo = true WHERE tipo='cor' AND codigo_local='prata';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 11, descricao = 'DOURADO',  ativo = true WHERE tipo='cor' AND codigo_local='dourado';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 12, descricao = 'LARANJA',  ativo = true WHERE tipo='cor' AND codigo_local='laranja';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 13, descricao = 'MARROM',   ativo = true WHERE tipo='cor' AND codigo_local='marrom';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 15, descricao = 'ROXO',     ativo = true WHERE tipo='cor' AND codigo_local='roxo';
UPDATE public.hinova_mapeamentos SET codigo_hinova = 16, descricao = 'ROSA',     ativo = true WHERE tipo='cor' AND codigo_local='rosa';

INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
SELECT 'cor', 'nao_especificado', 10, 'NAO ESPECIFICADO', true
WHERE NOT EXISTS (SELECT 1 FROM public.hinova_mapeamentos WHERE tipo='cor' AND codigo_local='nao_especificado');

INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
SELECT 'cor', 'fantasia', 14, 'FANTASIA', true
WHERE NOT EXISTS (SELECT 1 FROM public.hinova_mapeamentos WHERE tipo='cor' AND codigo_local='fantasia');

UPDATE public.hinova_mapeamentos SET ativo = false
WHERE tipo='cor' AND codigo_local IN ('bronze');

-- 2. Coluna em veiculos
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS codigo_sga_cor INTEGER;

COMMENT ON COLUMN public.veiculos.codigo_sga_cor IS 'Código SGA Hinova da cor (1=Preto, 2=Branca, 3=Azul, 4=Vermelho, 5=Verde, 6=Cinza, 7=Bege, 8=Amarelo, 9=Prata, 10=Não especificado, 11=Dourado, 12=Laranja, 13=Marrom, 14=Fantasia, 15=Roxo, 16=Rosa). Auto-preenchido por trigger.';

-- 3. Função normalizadora
CREATE OR REPLACE FUNCTION public.resolver_codigo_sga_cor(p_cor TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c TEXT;
BEGIN
  IF p_cor IS NULL OR btrim(p_cor) = '' THEN RETURN NULL; END IF;
  c := upper(btrim(p_cor));

  IF c LIKE '%PRET%' THEN RETURN 1; END IF;
  IF c LIKE '%BRANC%' THEN RETURN 2; END IF;
  IF c LIKE '%AZUL%' THEN RETURN 3; END IF;
  IF c LIKE '%VERMELH%' THEN RETURN 4; END IF;
  IF c LIKE '%VERDE%' THEN RETURN 5; END IF;
  IF c LIKE '%CINZA%' OR c LIKE '%GRAFITE%' THEN RETURN 6; END IF;
  IF c LIKE '%BEGE%' THEN RETURN 7; END IF;
  IF c LIKE '%AMAREL%' THEN RETURN 8; END IF;
  IF c LIKE '%PRATA%' OR c LIKE '%SILVER%' THEN RETURN 9; END IF;
  IF c LIKE '%DOURAD%' OR c LIKE '%GOLD%' THEN RETURN 11; END IF;
  IF c LIKE '%LARANJ%' THEN RETURN 12; END IF;
  IF c LIKE '%MARROM%' OR c LIKE '%MARRON%' OR c LIKE '%CASTANH%' THEN RETURN 13; END IF;
  IF c LIKE '%ROXO%' OR c LIKE '%ROXA%' OR c LIKE '%LILA%' OR c LIKE '%VIOLET%' THEN RETURN 15; END IF;
  IF c LIKE '%ROSA%' OR c LIKE '%PINK%' THEN RETURN 16; END IF;
  IF c LIKE '%FANTASIA%' OR c LIKE '%PERSONALIZ%' OR c LIKE '%MULTICO%' THEN RETURN 14; END IF;
  IF c LIKE '%BRONZE%' THEN RETURN 11; END IF;

  RETURN 10; -- Não especificado (fallback)
END;
$$;

-- 4. Trigger
CREATE OR REPLACE FUNCTION public.trg_set_codigo_sga_cor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.cor IS DISTINCT FROM OLD.cor THEN
    NEW.codigo_sga_cor := public.resolver_codigo_sga_cor(NEW.cor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_veiculos_codigo_sga_cor ON public.veiculos;
CREATE TRIGGER trg_veiculos_codigo_sga_cor
BEFORE INSERT OR UPDATE OF cor ON public.veiculos
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_codigo_sga_cor();

-- 5. Backfill seguro
DO $$
DECLARE
  v_id UUID;
  v_cor TEXT;
  v_codigo INTEGER;
  v_skipped INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  FOR v_id, v_cor IN
    SELECT id, cor FROM public.veiculos
     WHERE cor IS NOT NULL AND codigo_sga_cor IS NULL
  LOOP
    v_codigo := public.resolver_codigo_sga_cor(v_cor);
    IF v_codigo IS NOT NULL THEN
      BEGIN
        UPDATE public.veiculos SET codigo_sga_cor = v_codigo WHERE id = v_id;
        v_updated := v_updated + 1;
      EXCEPTION WHEN OTHERS THEN v_skipped := v_skipped + 1;
      END;
    END IF;
  END LOOP;
  RAISE NOTICE 'Backfill cor SGA: atualizados=%, ignorados=%', v_updated, v_skipped;
END $$;
