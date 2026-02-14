
-- 1. Adicionar campos específicos de vidros na tabela sinistros
ALTER TABLE sinistros 
  ADD COLUMN peca_danificada TEXT,
  ADD COLUMN opcao_reparo TEXT,
  ADD COLUMN valor_reembolso NUMERIC,
  ADD COLUMN nf_reembolso_url TEXT;

-- 2. Criar tabela de histórico de utilização de vidros
CREATE TABLE sinistro_vidros_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id),
  veiculo_id UUID NOT NULL REFERENCES veiculos(id),
  sinistro_id UUID NOT NULL REFERENCES sinistros(id),
  peca TEXT NOT NULL,
  data_utilizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE sinistro_vidros_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vidros historico"
  ON sinistro_vidros_historico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vidros historico"
  ON sinistro_vidros_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices
CREATE INDEX idx_vidros_historico_associado ON sinistro_vidros_historico(associado_id);
CREATE INDEX idx_vidros_historico_peca ON sinistro_vidros_historico(associado_id, peca, data_utilizacao);
