-- 1. Alterar FK de vistorias para CASCADE (excluir junto)
ALTER TABLE vistorias 
DROP CONSTRAINT IF EXISTS vistorias_cotacao_id_fkey;

ALTER TABLE vistorias 
ADD CONSTRAINT vistorias_cotacao_id_fkey 
FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

-- 2. Alterar FK de instalacoes para CASCADE (excluir junto)
ALTER TABLE instalacoes 
DROP CONSTRAINT IF EXISTS instalacoes_cotacao_id_fkey;

ALTER TABLE instalacoes 
ADD CONSTRAINT instalacoes_cotacao_id_fkey 
FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

-- 3. Alterar FK de leads para SET NULL (não excluir lead, apenas limpar referência)
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_cotacao_id_fkey;

ALTER TABLE leads 
ADD CONSTRAINT leads_cotacao_id_fkey 
FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE SET NULL;