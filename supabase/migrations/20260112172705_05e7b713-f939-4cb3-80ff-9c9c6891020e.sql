-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Remover estrutura de consultores e unificar em vendedores
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Migrar dados de consultor_id para vendedor_id onde possível
-- (Caso existam leads com consultor_id preenchido mas vendedor_id vazio)
UPDATE leads 
SET vendedor_id = consultor_id 
WHERE vendedor_id IS NULL 
  AND consultor_id IS NOT NULL;

-- 2. Remover a foreign key de consultor_id
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_consultor_id_fkey;

-- 3. Remover a coluna consultor_id da tabela leads
ALTER TABLE leads DROP COLUMN IF EXISTS consultor_id;

-- 4. Dropar a tabela consultores (não é mais necessária)
DROP TABLE IF EXISTS consultores CASCADE;