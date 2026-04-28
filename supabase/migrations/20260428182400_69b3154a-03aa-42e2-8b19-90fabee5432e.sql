-- 1) Correção pontual do caso reportado (KNO3F78)
UPDATE public.veiculos
SET chassi = '9BD17104G85241143', updated_at = now()
WHERE id = '6915f219-0d34-4169-89b1-758e982aa51e' AND chassi = '9BD17104G8524113';

UPDATE public.cotacoes
SET veiculo_chassi = '9BD17104G85241143', updated_at = now()
WHERE id = '1036666f-5de5-461d-a330-061b265d6040' AND veiculo_chassi = '9BD17104G8524113';

-- 2) CHECK constraints com NOT VALID (não revalida legado, mas barra novos inválidos)
ALTER TABLE public.veiculos
  DROP CONSTRAINT IF EXISTS veiculos_chassi_format;
ALTER TABLE public.veiculos
  ADD CONSTRAINT veiculos_chassi_format
  CHECK (chassi IS NULL OR chassi = '' OR chassi ~ '^[A-HJ-NPR-Z0-9]{17}$')
  NOT VALID;

ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_chassi_format;
ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_chassi_format
  CHECK (veiculo_chassi IS NULL OR veiculo_chassi = '' OR veiculo_chassi ~ '^[A-HJ-NPR-Z0-9]{17}$')
  NOT VALID;