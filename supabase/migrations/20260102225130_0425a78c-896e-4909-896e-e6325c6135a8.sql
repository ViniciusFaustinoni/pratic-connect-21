-- Adicionar novas etapas ao enum etapa_lead
ALTER TYPE etapa_lead ADD VALUE IF NOT EXISTS 'vistoria_agendada' AFTER 'negociacao';
ALTER TYPE etapa_lead ADD VALUE IF NOT EXISTS 'contrato_enviado' AFTER 'vistoria_agendada';
ALTER TYPE etapa_lead ADD VALUE IF NOT EXISTS 'contrato_assinado' AFTER 'contrato_enviado';
ALTER TYPE etapa_lead ADD VALUE IF NOT EXISTS 'instalacao_agendada' AFTER 'contrato_assinado';

-- Adicionar novos status ao enum status_contrato
ALTER TYPE status_contrato ADD VALUE IF NOT EXISTS 'enviado' AFTER 'pendente';
ALTER TYPE status_contrato ADD VALUE IF NOT EXISTS 'assinado' AFTER 'enviado';

-- Criar enum para motivo de perda
DO $$ BEGIN
    CREATE TYPE motivo_perda AS ENUM (
        'preco',
        'concorrencia', 
        'desistiu',
        'nao_qualificado',
        'veiculo_reprovado',
        'nao_respondeu',
        'outro'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Adicionar novos campos na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_primeiro_contato TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_ultimo_contato TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_proxima_acao TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_perda TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_conversao TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS associado_id UUID REFERENCES associados(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS indicador_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS observacao_perda TEXT;

-- Criar tabela de histórico de leads
CREATE TABLE IF NOT EXISTS leads_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    usuario_id UUID,
    etapa_anterior TEXT,
    etapa_nova TEXT,
    acao VARCHAR(100) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_historico_lead ON leads_historico(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_data_proxima_acao ON leads(data_proxima_acao);
CREATE INDEX IF NOT EXISTS idx_leads_associado ON leads(associado_id);

-- Enable RLS
ALTER TABLE leads_historico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para leads_historico
CREATE POLICY "Staff can view lead history" ON leads_historico
FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "Staff can insert lead history" ON leads_historico
FOR INSERT WITH CHECK (is_funcionario(auth.uid()));