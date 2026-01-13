-- Corrigir foreign keys para permitir exclusão em cascata

-- 1. asaas_cobrancas: excluir cobranças ao excluir contrato
ALTER TABLE asaas_cobrancas 
  DROP CONSTRAINT IF EXISTS asaas_cobrancas_contrato_id_fkey;
ALTER TABLE asaas_cobrancas
  ADD CONSTRAINT asaas_cobrancas_contrato_id_fkey 
    FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

-- 2. cobrancas: excluir ao excluir contrato
ALTER TABLE cobrancas 
  DROP CONSTRAINT IF EXISTS cobrancas_contrato_id_fkey;
ALTER TABLE cobrancas
  ADD CONSTRAINT cobrancas_contrato_id_fkey 
    FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

-- 3. contratos_historico: excluir ao excluir contrato
ALTER TABLE contratos_historico 
  DROP CONSTRAINT IF EXISTS contratos_historico_contrato_id_fkey;
ALTER TABLE contratos_historico
  ADD CONSTRAINT contratos_historico_contrato_id_fkey 
    FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE;

-- 4. associados: desvincular do contrato ao excluir (SET NULL)
ALTER TABLE associados 
  DROP CONSTRAINT IF EXISTS associados_contrato_id_fkey;
ALTER TABLE associados
  ADD CONSTRAINT associados_contrato_id_fkey 
    FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE SET NULL;

-- 5. contratos: desvincular cotação ao excluir cotação (SET NULL)
ALTER TABLE contratos 
  DROP CONSTRAINT IF EXISTS contratos_cotacao_id_fkey;
ALTER TABLE contratos
  ADD CONSTRAINT contratos_cotacao_id_fkey 
    FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE SET NULL;