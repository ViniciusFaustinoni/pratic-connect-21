-- ==========================================
-- CORREÇÃO 1: Vincular documentos existentes ao cotacao_id extraído da URL
-- ==========================================

UPDATE contratos_documentos
SET cotacao_id = (
  SELECT c.id 
  FROM cotacoes c 
  WHERE contratos_documentos.arquivo_url ILIKE '%' || c.id::text || '%'
  LIMIT 1
)
WHERE cotacao_id IS NULL 
  AND arquivo_url LIKE '%cotacoes-docs/%';

-- ==========================================
-- CORREÇÃO 2: Copiar endereço da cotação para associados existentes que não têm endereço
-- ==========================================

UPDATE associados a
SET 
  logradouro = COALESCE(a.logradouro, c.cliente_logradouro),
  numero = COALESCE(a.numero, c.cliente_numero),
  complemento = COALESCE(a.complemento, c.cliente_complemento),
  bairro = COALESCE(a.bairro, c.cliente_bairro),
  cidade = COALESCE(a.cidade, c.cliente_cidade),
  uf = COALESCE(a.uf, c.cliente_uf),
  cep = COALESCE(a.cep, c.cliente_cep),
  data_nascimento = COALESCE(a.data_nascimento, c.cliente_data_nascimento)
FROM contratos ct
JOIN cotacoes c ON c.id = ct.cotacao_id
WHERE a.id = ct.associado_id
  AND a.logradouro IS NULL
  AND c.cliente_logradouro IS NOT NULL;