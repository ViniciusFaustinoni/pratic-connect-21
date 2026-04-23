
-- 1) Adiciona coluna tipo_veiculo
ALTER TABLE public.marcas_modelos
  ADD COLUMN IF NOT EXISTS tipo_veiculo text;

ALTER TABLE public.marcas_modelos
  DROP CONSTRAINT IF EXISTS marcas_modelos_tipo_veiculo_check;

ALTER TABLE public.marcas_modelos
  ADD CONSTRAINT marcas_modelos_tipo_veiculo_check
  CHECK (tipo_veiculo IS NULL OR tipo_veiculo IN ('carro','moto','caminhao','onibus','utilitario','outros'));

CREATE INDEX IF NOT EXISTS idx_marcas_modelos_tipo ON public.marcas_modelos(tipo_veiculo);

-- 2) Consolida marcas duplicadas no catálogo (preserva modelos via DELETE/INSERT seguro)
-- a) Move modelos de GM - CHEVROLET para CHEVROLET, evitando duplicidade
INSERT INTO public.marcas_modelos (marca, modelo, ativo, tipo_veiculo)
SELECT DISTINCT 'CHEVROLET', m.modelo, true, NULL
FROM public.marcas_modelos m
WHERE m.marca = 'GM - CHEVROLET'
  AND NOT EXISTS (
    SELECT 1 FROM public.marcas_modelos x
    WHERE x.marca = 'CHEVROLET' AND x.modelo IS NOT DISTINCT FROM m.modelo
  );
DELETE FROM public.marcas_modelos WHERE marca = 'GM - CHEVROLET';

-- b) KIA MOTORS -> KIA
INSERT INTO public.marcas_modelos (marca, modelo, ativo, tipo_veiculo)
SELECT DISTINCT 'KIA', m.modelo, true, NULL
FROM public.marcas_modelos m
WHERE m.marca = 'KIA MOTORS'
  AND NOT EXISTS (
    SELECT 1 FROM public.marcas_modelos x
    WHERE x.marca = 'KIA' AND x.modelo IS NOT DISTINCT FROM m.modelo
  );
DELETE FROM public.marcas_modelos WHERE marca = 'KIA MOTORS';

-- c) CAOA CHERY/CHERY -> CAOA CHERY
INSERT INTO public.marcas_modelos (marca, modelo, ativo, tipo_veiculo)
SELECT DISTINCT 'CAOA CHERY', m.modelo, true, NULL
FROM public.marcas_modelos m
WHERE m.marca = 'CAOA CHERY/CHERY'
  AND NOT EXISTS (
    SELECT 1 FROM public.marcas_modelos x
    WHERE x.marca = 'CAOA CHERY' AND x.modelo IS NOT DISTINCT FROM m.modelo
  );
DELETE FROM public.marcas_modelos WHERE marca = 'CAOA CHERY/CHERY';

-- d) VW - VOLKSWAGEN -> VOLKSWAGEN (caso exista)
INSERT INTO public.marcas_modelos (marca, modelo, ativo, tipo_veiculo)
SELECT DISTINCT 'VOLKSWAGEN', m.modelo, true, NULL
FROM public.marcas_modelos m
WHERE m.marca = 'VW - VOLKSWAGEN'
  AND NOT EXISTS (
    SELECT 1 FROM public.marcas_modelos x
    WHERE x.marca = 'VOLKSWAGEN' AND x.modelo IS NOT DISTINCT FROM m.modelo
  );
DELETE FROM public.marcas_modelos WHERE marca = 'VW - VOLKSWAGEN';

-- 3) Atualiza regras de elegibilidade existentes para usar marca consolidada
-- (o motor já é tolerante via includes(), mas isso mantém consistência visual)
UPDATE public.entity_eligibility_rules
SET rule_config = jsonb_set(
  rule_config,
  '{modelos}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'marca' = 'GM - CHEVROLET' THEN jsonb_set(elem, '{marca}', '"CHEVROLET"')
        WHEN elem->>'marca' = 'KIA MOTORS' THEN jsonb_set(elem, '{marca}', '"KIA"')
        WHEN elem->>'marca' = 'CAOA CHERY/CHERY' THEN jsonb_set(elem, '{marca}', '"CAOA CHERY"')
        WHEN elem->>'marca' = 'VW - VOLKSWAGEN' THEN jsonb_set(elem, '{marca}', '"VOLKSWAGEN"')
        ELSE elem
      END
    )
    FROM jsonb_array_elements(rule_config->'modelos') elem
  )
)
WHERE rule_type = 'marca_modelo'
  AND rule_config ? 'modelos'
  AND jsonb_typeof(rule_config->'modelos') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(rule_config->'modelos') elem
    WHERE elem->>'marca' IN ('GM - CHEVROLET','KIA MOTORS','CAOA CHERY/CHERY','VW - VOLKSWAGEN')
  );

-- 4) Backfill heurístico de tipo_veiculo
-- Motos
UPDATE public.marcas_modelos SET tipo_veiculo = 'moto'
WHERE tipo_veiculo IS NULL AND marca IN (
  'HONDA MOTOS','YAMAHA','KAWASAKI','SUZUKI','DUCATI','HARLEY-DAVIDSON',
  'TRIUMPH','APRILIA','BMW MOTORRAD','KTM','HUSQVARNA','BENELLI','ROYAL ENFIELD',
  'MV AGUSTA','INDIAN','HUSABERG','BAJAJ','DAFRA','SHINERAY','HAOJUE','TRAXX',
  'AVELLOZ','GARINNI','MOTO GUZZI','PIAGGIO','VESPA','KASINSKI','KYMCO','SYM',
  'JONNY','HERO','ATALA','BETA','BIMOTA','BUELL','CAGIVA','DAELIM','DAYANG',
  'DAYUN','DERBI','FYM','GAS GAS','HARTFORD','JOHNNYPAG','MALAGUTI','MOTOMORINI',
  'MRX','PEGASSI','REGAL RAPTOR','SANYANG','SIAMOTO','MOTOCAR','LON-V','HISUN',
  'GREEN','BRANDY','BEE','ARROW','ADLY','AMAZONAS','BRAVA','BYCRISTO','BUENO',
  'FUSCO MOTOSEGURA','FYBER','HAOBAO','HONDA MOTO','JIAPENG VOLCANO','L''AQUILA',
  'LERIVO','LEVA','MAGRÃO TRICICLOS','MIZA','MOTORINO','MVK','NIU','ORCA',
  'RIGUETE','SBM','BAJAJ','HITECH ELECTRIC','IROS','POLARIS','BRP'
);

-- Caminhões
UPDATE public.marcas_modelos SET tipo_veiculo = 'caminhao'
WHERE tipo_veiculo IS NULL AND marca IN (
  'SCANIA','VOLVO','MAN','IVECO','DAF','SHACMAN','SINOTRUK','FOTON',
  'NAVISTAR','SAAB-SCANIA','LAVRALE','AGRALE'
);

-- Ônibus
UPDATE public.marcas_modelos SET tipo_veiculo = 'onibus'
WHERE tipo_veiculo IS NULL AND marca IN (
  'MARCOPOLO','NEOBUS','MASCARELLO','CICCOBUS','BEPOBUS','MAXIBUS','FIBRAVAN'
);

-- Resto: carro
UPDATE public.marcas_modelos SET tipo_veiculo = 'carro'
WHERE tipo_veiculo IS NULL;
