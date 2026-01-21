-- Tabela para rastrear fotos de sinistros
CREATE TABLE IF NOT EXISTS sinistro_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id UUID NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL DEFAULT 'geral',
  storage_path TEXT NOT NULL,
  nome_arquivo TEXT,
  tamanho_bytes INTEGER,
  enviado_por UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT sinistro_fotos_tipo_check CHECK (tipo IN (
    'dano_frente', 'dano_traseira', 'dano_lateral_esq', 'dano_lateral_dir',
    'dano_interno', 'local', 'terceiro', 'documento', 'outro', 'geral'
  )),
  CONSTRAINT sinistro_fotos_status_check CHECK (status IN ('ativo', 'excluido'))
);

-- Índices para queries
CREATE INDEX IF NOT EXISTS idx_sinistro_fotos_sinistro ON sinistro_fotos(sinistro_id);
CREATE INDEX IF NOT EXISTS idx_sinistro_fotos_status ON sinistro_fotos(status);

-- RLS
ALTER TABLE sinistro_fotos ENABLE ROW LEVEL SECURITY;

-- Associado vê apenas fotos dos seus sinistros
CREATE POLICY "sinistro_fotos_select_associado"
ON sinistro_fotos FOR SELECT
USING (
  sinistro_id IN (
    SELECT s.id FROM sinistros s
    INNER JOIN associados a ON a.id = s.associado_id
    WHERE a.user_id = auth.uid()
  )
  OR is_funcionario(auth.uid())
);

-- Associado pode inserir fotos nos seus sinistros
CREATE POLICY "sinistro_fotos_insert_associado"
ON sinistro_fotos FOR INSERT
WITH CHECK (
  sinistro_id IN (
    SELECT s.id FROM sinistros s
    INNER JOIN associados a ON a.id = s.associado_id
    WHERE a.user_id = auth.uid()
  )
  OR is_funcionario(auth.uid())
);

-- Associado pode excluir fotos antes do sinistro ser analisado
CREATE POLICY "sinistro_fotos_delete_associado"
ON sinistro_fotos FOR DELETE
USING (
  sinistro_id IN (
    SELECT s.id FROM sinistros s
    INNER JOIN associados a ON a.id = s.associado_id
    WHERE a.user_id = auth.uid()
    AND s.status = 'comunicado'
  )
  OR is_funcionario(auth.uid())
);

-- Funcionários podem atualizar fotos
CREATE POLICY "sinistro_fotos_update_funcionarios"
ON sinistro_fotos FOR UPDATE
USING (is_funcionario(auth.uid()));