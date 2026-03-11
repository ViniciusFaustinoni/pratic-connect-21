
-- 1. Adicionar coluna JSONB no contrato para snapshot dos adicionais selecionados
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS adicionais_selecionados JSONB DEFAULT '[]';

-- 2. Adicionar linhas permitidas nos benefícios adicionais
ALTER TABLE beneficios_adicionais ADD COLUMN IF NOT EXISTS linhas_permitidas TEXT[] DEFAULT '{}';

-- 3. Tabela relacional: quais adicionais estão ativos por associado/contrato
CREATE TABLE IF NOT EXISTS associados_beneficios_adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  beneficio_adicional_id UUID NOT NULL REFERENCES beneficios_adicionais(id),
  valor_contratado NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(associado_id, beneficio_adicional_id, contrato_id)
);

ALTER TABLE associados_beneficios_adicionais ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read
CREATE POLICY "authenticated_read_associados_beneficios"
  ON associados_beneficios_adicionais
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS: authenticated users can insert/update/delete
CREATE POLICY "authenticated_manage_associados_beneficios"
  ON associados_beneficios_adicionais
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role (edge functions) full access
CREATE POLICY "service_role_full_access_associados_beneficios"
  ON associados_beneficios_adicionais
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
