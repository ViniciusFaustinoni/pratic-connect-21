-- V25: Melhorias na Estrutura de Contratos + Histórico

-- 1. Adicionar novos valores ao enum status_contrato
ALTER TYPE status_contrato ADD VALUE IF NOT EXISTS 'visualizado';
ALTER TYPE status_contrato ADD VALUE IF NOT EXISTS 'expirado';
ALTER TYPE status_contrato ADD VALUE IF NOT EXISTS 'pendente_assinatura';

-- 2. Adicionar colunas à tabela contratos
ALTER TABLE contratos 
  ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_visualizacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_assinatura TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_ativacao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validade_link TIMESTAMPTZ;

ALTER TABLE contratos 
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_assinado_url TEXT;

ALTER TABLE contratos 
  ADD COLUMN IF NOT EXISTS autentique_status VARCHAR(30);

ALTER TABLE contratos 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- 3. Criar tabela contratos_historico
CREATE TABLE IF NOT EXISTS contratos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE NOT NULL,
  evento VARCHAR(100) NOT NULL,
  descricao TEXT,
  dados JSONB,
  usuario_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contratos_hist_contrato ON contratos_historico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_hist_created ON contratos_historico(created_at DESC);

-- 4. RLS para contratos_historico
ALTER TABLE contratos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios can view contract history" ON contratos_historico
  FOR SELECT USING (am_i_funcionario());

CREATE POLICY "Funcionarios can insert contract history" ON contratos_historico
  FOR INSERT WITH CHECK (am_i_funcionario());

-- 5. Trigger para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION fn_registrar_historico_contrato()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO contratos_historico (contrato_id, evento, descricao, dados)
    VALUES (NEW.id, 'contrato_criado', 'Contrato ' || NEW.numero || ' criado', 
            jsonb_build_object('numero', NEW.numero, 'status', NEW.status::text));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO contratos_historico (contrato_id, evento, descricao, dados)
      VALUES (NEW.id, 'status_alterado', 
              'Status alterado de ' || OLD.status::text || ' para ' || NEW.status::text,
              jsonb_build_object('status_anterior', OLD.status::text, 'status_novo', NEW.status::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger se existir e recriar
DROP TRIGGER IF EXISTS trg_contratos_historico ON contratos;
CREATE TRIGGER trg_contratos_historico
  AFTER INSERT OR UPDATE ON contratos
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_historico_contrato();