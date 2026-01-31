-- ═══════════════════════════════════════════════════════════════════════════
-- DOCUMENT TYPES - Tipos de documento fixos do sistema
-- ═══════════════════════════════════════════════════════════════════════════

-- Criar enum para status do template
CREATE TYPE template_status AS ENUM ('draft', 'active', 'archived');

-- Criar tabela de tipos de documento
CREATE TABLE public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  send_moment VARCHAR(100),
  target_audience VARCHAR(100),
  required_variables JSONB DEFAULT '[]',
  icon VARCHAR(50) DEFAULT 'file',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir tipos de documento padrão do sistema
INSERT INTO public.document_types (code, name, description, send_moment, target_audience, required_variables, icon, sort_order) VALUES
('comparativo_planos', 'Comparativo de Planos', 'Documento comparativo mostrando os planos disponíveis', 'Prospecção', 'Leads e Prospectos', '["nome_cliente"]', 'table-2', 1),
('proposta_comercial', 'Proposta Comercial', 'Proposta personalizada para o cliente', 'Negociação', 'Leads qualificados', '["nome_cliente", "veiculo", "plano", "valor_mensalidade"]', 'file-text', 2),
('contrato_adesao', 'Contrato de Adesão', 'Contrato oficial de adesão à associação', 'Fechamento', 'Novos associados', '["nome_cliente", "cpf", "endereco", "veiculo", "placa", "plano", "valor_mensalidade"]', 'file-signature', 3),
('termo_vistoria', 'Termo de Vistoria', 'Termo de vistoria do veículo', 'Pré-adesão', 'Novos associados', '["nome_cliente", "veiculo", "placa"]', 'car', 4),
('carta_boas_vindas', 'Carta de Boas-Vindas', 'Carta de boas-vindas ao novo associado', 'Pós-adesão', 'Novos associados', '["nome_cliente", "plano"]', 'heart', 5),
('certificado_cobertura', 'Certificado de Cobertura', 'Certificado com as coberturas do associado', 'Pós-adesão', 'Associados ativos', '["nome_cliente", "veiculo", "placa", "coberturas"]', 'shield-check', 6),
('boleto_cobranca', 'Boleto/Cobrança', 'Documento de cobrança mensal', 'Financeiro', 'Associados', '["nome_cliente", "valor", "vencimento"]', 'receipt', 7),
('carta_cobranca', 'Carta de Cobrança', 'Carta de cobrança para inadimplentes', 'Inadimplência', 'Inadimplentes', '["nome_cliente", "valor", "dias_atraso"]', 'alert-circle', 8),
('autorizacao_servico', 'Autorização de Serviço', 'Autorização para execução de serviços', 'Sinistro', 'Em sinistro', '["nome_cliente", "veiculo", "oficina", "servicos"]', 'wrench', 9),
('recibo_pagamento', 'Recibo de Pagamento', 'Recibo de pagamento efetuado', 'Financeiro', 'Associados', '["nome_cliente", "valor", "referencia"]', 'check-circle', 10);

-- ═══════════════════════════════════════════════════════════════════════════
-- ATUALIZAR DOCUMENTO_TEMPLATES
-- ═══════════════════════════════════════════════════════════════════════════

-- Adicionar novos campos à tabela documento_templates
ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS document_type_id UUID REFERENCES public.document_types(id),
  ADD COLUMN IF NOT EXISTS canvas_data JSONB,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status template_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_documento_templates_document_type ON public.documento_templates(document_type_id);
CREATE INDEX IF NOT EXISTS idx_documento_templates_is_default ON public.documento_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_document_types_code ON public.document_types(code);

-- ═══════════════════════════════════════════════════════════════════════════
-- TEMPLATE_VERSIONS - Histórico de versões para auditoria
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.documento_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  canvas_data JSONB,
  conteudo TEXT,
  config_layout JSONB,
  change_description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON public.template_versions(template_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

-- Document Types: Leitura para todos funcionários, escrita só gerência
CREATE POLICY "Document types são visíveis para funcionários"
  ON public.document_types FOR SELECT
  USING (public.am_i_funcionario());

CREATE POLICY "Apenas gerência pode modificar document types"
  ON public.document_types FOR ALL
  USING (public.am_i_gerencia())
  WITH CHECK (public.am_i_gerencia());

-- Template Versions: Leitura para funcionários
CREATE POLICY "Template versions são visíveis para funcionários"
  ON public.template_versions FOR SELECT
  USING (public.am_i_funcionario());

CREATE POLICY "Apenas gerência pode criar template versions"
  ON public.template_versions FOR INSERT
  WITH CHECK (public.am_i_gerencia());

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER PARA ATUALIZAR updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_document_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_document_types_timestamp
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_types_updated_at();