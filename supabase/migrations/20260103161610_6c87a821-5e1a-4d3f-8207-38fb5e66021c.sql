-- =============================================
-- FASE 1: Expandir Enums
-- =============================================

-- 1.1 Adicionar novos valores ao tipo_sinistro
ALTER TYPE tipo_sinistro ADD VALUE IF NOT EXISTS 'fenomeno_natural';
ALTER TYPE tipo_sinistro ADD VALUE IF NOT EXISTS 'vidros';
ALTER TYPE tipo_sinistro ADD VALUE IF NOT EXISTS 'terceiros';

-- 1.2 Adicionar novos valores ao status_sinistro
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'comunicado';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'documentacao_pendente';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_vistoria';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_vistoria';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_parecer';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'negado';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_regulacao';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_reparo';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'pago';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'encerrado';

-- =============================================
-- FASE 2: Adicionar Colunas em sinistros
-- =============================================

ALTER TABLE sinistros 
ADD COLUMN IF NOT EXISTS local_ocorrencia VARCHAR(255),
ADD COLUMN IF NOT EXISTS cidade_ocorrencia VARCHAR(100),
ADD COLUMN IF NOT EXISTS estado_ocorrencia VARCHAR(2),
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS parecer TEXT,
ADD COLUMN IF NOT EXISTS data_parecer TIMESTAMPTZ;

-- =============================================
-- FASE 3: Criar Tabela sinistro_documentos
-- =============================================

CREATE TABLE IF NOT EXISTS sinistro_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sinistro_id UUID NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    nome_arquivo TEXT,
    arquivo_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    motivo_reprovacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FASE 4: Criar Tabela sinistro_historico
-- =============================================

CREATE TABLE IF NOT EXISTS sinistro_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sinistro_id UUID NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    usuario_id UUID REFERENCES profiles(user_id),
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FASE 5: Habilitar RLS e Criar Policies
-- =============================================

-- 5.1 RLS para sinistro_documentos
ALTER TABLE sinistro_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associates can view own claim documents"
ON sinistro_documentos FOR SELECT
USING (
    sinistro_id IN (
        SELECT id FROM sinistros 
        WHERE associado_id = get_my_associado_id(auth.uid())
    )
);

CREATE POLICY "Associates can insert own claim documents"
ON sinistro_documentos FOR INSERT
WITH CHECK (
    sinistro_id IN (
        SELECT id FROM sinistros 
        WHERE associado_id = get_my_associado_id(auth.uid())
    )
);

CREATE POLICY "Staff can manage claim documents"
ON sinistro_documentos FOR ALL
USING (is_funcionario(auth.uid()));

-- 5.2 RLS para sinistro_historico
ALTER TABLE sinistro_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associates can view own claim history"
ON sinistro_historico FOR SELECT
USING (
    sinistro_id IN (
        SELECT id FROM sinistros 
        WHERE associado_id = get_my_associado_id(auth.uid())
    )
);

CREATE POLICY "Staff can view claim history"
ON sinistro_historico FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "System can insert claim history"
ON sinistro_historico FOR INSERT
WITH CHECK (true);

-- =============================================
-- FASE 6: Trigger para Histórico Automático
-- =============================================

CREATE OR REPLACE FUNCTION fn_sinistro_historico()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO sinistro_historico (sinistro_id, status_anterior, status_novo)
    VALUES (NEW.id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sinistro_historico ON sinistros;

CREATE TRIGGER trg_sinistro_historico
AFTER UPDATE ON sinistros
FOR EACH ROW EXECUTE FUNCTION fn_sinistro_historico();

-- =============================================
-- FASE 7: Índices para Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_sinistro_documentos_sinistro_id 
ON sinistro_documentos(sinistro_id);

CREATE INDEX IF NOT EXISTS idx_sinistro_historico_sinistro_id 
ON sinistro_historico(sinistro_id);

CREATE INDEX IF NOT EXISTS idx_sinistro_historico_created_at 
ON sinistro_historico(created_at DESC);