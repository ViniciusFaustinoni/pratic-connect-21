-- Corrigir dependência circular: cotacoes.vistoria_id e contratos.vistoria_id apontam para vistorias
-- Alterar para ON DELETE SET NULL para permitir exclusão de vistorias

-- 1. Alterar FK de cotacoes.vistoria_id para SET NULL
ALTER TABLE cotacoes 
DROP CONSTRAINT IF EXISTS cotacoes_vistoria_id_fkey;

ALTER TABLE cotacoes 
ADD CONSTRAINT cotacoes_vistoria_id_fkey 
FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE SET NULL;

-- 2. Alterar FK de contratos.vistoria_id para SET NULL
ALTER TABLE contratos 
DROP CONSTRAINT IF EXISTS contratos_vistoria_id_fkey;

ALTER TABLE contratos 
ADD CONSTRAINT contratos_vistoria_id_fkey 
FOREIGN KEY (vistoria_id) REFERENCES vistorias(id) ON DELETE SET NULL;