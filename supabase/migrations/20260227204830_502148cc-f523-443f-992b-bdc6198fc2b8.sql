-- Add decisao_instalador column to servicos table
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS decisao_instalador TEXT CHECK (decisao_instalador IN ('aprovado', 'aprovado_ressalva', 'negado'));
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS ressalvas_instalador TEXT;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS fotos_ressalva TEXT[];

COMMENT ON COLUMN servicos.decisao_instalador IS 'Decisão do instalador: aprovado, aprovado_ressalva, ou negado';
COMMENT ON COLUMN servicos.ressalvas_instalador IS 'Descrição das ressalvas quando aprovado com ressalva';
COMMENT ON COLUMN servicos.fotos_ressalva IS 'URLs das fotos de evidência para ressalvas';