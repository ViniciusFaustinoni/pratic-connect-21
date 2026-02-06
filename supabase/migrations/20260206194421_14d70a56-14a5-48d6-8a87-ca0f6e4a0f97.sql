-- Corrigir cotação específica LTB4J74 que está com status incorreto
UPDATE cotacoes 
SET status = 'recusada'
WHERE id = 'f7091946-4f10-423b-bc96-93520ed045ad';