-- Alterar FK de vistorias para CASCADE
ALTER TABLE vistorias 
  DROP CONSTRAINT IF EXISTS vistorias_contrato_id_fkey;

ALTER TABLE vistorias 
  ADD CONSTRAINT vistorias_contrato_id_fkey 
    FOREIGN KEY (contrato_id) 
    REFERENCES contratos(id) 
    ON DELETE CASCADE;