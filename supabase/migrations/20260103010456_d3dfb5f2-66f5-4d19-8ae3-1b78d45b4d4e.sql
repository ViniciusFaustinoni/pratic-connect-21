-- =====================================================
-- MÓDULO 3: CADASTRO - Migração Completa
-- =====================================================

-- 1. Adicionar valores aos enums existentes
ALTER TYPE status_associado ADD VALUE IF NOT EXISTS 'aprovado' AFTER 'em_analise';
ALTER TYPE status_associado ADD VALUE IF NOT EXISTS 'bloqueado' AFTER 'cancelado';
ALTER TYPE status_documento ADD VALUE IF NOT EXISTS 'expirado' AFTER 'reprovado';

-- 2. Criar enum status_veiculo
DO $$ BEGIN
  CREATE TYPE status_veiculo AS ENUM (
    'em_analise',
    'aprovado',
    'instalacao_pendente',
    'ativo',
    'suspenso',
    'cancelado',
    'sinistrado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Adicionar colunas na tabela associados
ALTER TABLE associados
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS data_adesao DATE,
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER,
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT,
  ADD COLUMN IF NOT EXISTS data_bloqueio TIMESTAMPTZ;

-- Adicionar constraint de dia_vencimento
ALTER TABLE associados DROP CONSTRAINT IF EXISTS associados_dia_vencimento_check;
ALTER TABLE associados ADD CONSTRAINT associados_dia_vencimento_check CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 28));

-- 4. Adicionar colunas na tabela veiculos
ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS uso_aplicativo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plataforma_app TEXT,
  ADD COLUMN IF NOT EXISTS status status_veiculo DEFAULT 'em_analise';

-- 5. Migrar dados do boolean ativo para status enum
UPDATE veiculos SET status = CASE 
  WHEN ativo = true THEN 'ativo'::status_veiculo 
  ELSE 'cancelado'::status_veiculo 
END WHERE status IS NULL;

-- 6. Criar bucket documentos para storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Políticas de storage para bucket documentos
DROP POLICY IF EXISTS "Staff can manage documents bucket" ON storage.objects;
CREATE POLICY "Staff can manage documents bucket" ON storage.objects
  FOR ALL USING (bucket_id = 'documentos' AND is_funcionario(auth.uid()));

DROP POLICY IF EXISTS "Associates can upload own documents bucket" ON storage.objects;
CREATE POLICY "Associates can upload own documents bucket" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documentos' AND 
    (storage.foldername(name))[1] = get_my_associado_id(auth.uid())::text
  );

DROP POLICY IF EXISTS "Associates can view own documents bucket" ON storage.objects;
CREATE POLICY "Associates can view own documents bucket" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documentos' AND 
    (storage.foldername(name))[1] = get_my_associado_id(auth.uid())::text
  );

-- 8. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_associados_cpf ON associados(cpf);
CREATE INDEX IF NOT EXISTS idx_associados_status ON associados(status);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_veiculos_associado ON veiculos(associado_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_status ON veiculos(status);
CREATE INDEX IF NOT EXISTS idx_documentos_associado ON documentos(associado_id);
CREATE INDEX IF NOT EXISTS idx_documentos_status ON documentos(status);