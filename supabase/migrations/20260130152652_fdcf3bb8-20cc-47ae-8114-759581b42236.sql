-- ============================================
-- MIGRAÇÃO: NOVOS STATUS E CAMPOS SINISTROS - SGA PRATIC 2.0
-- ============================================

-- 1. Adicionar novos valores ao enum status_sinistro
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_pericia';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'suspenso';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'analise_interna';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_cota';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'aguardando_termo';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_garantia';
ALTER TYPE status_sinistro ADD VALUE IF NOT EXISTS 'em_recuperacao';

-- 2. Novos campos para dados do condutor
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS condutor_nome VARCHAR(255);
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS condutor_cnh VARCHAR(20);
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS condutor_relacao VARCHAR(50); -- 'associado', 'terceiro_autorizado', 'terceiro'
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS condutor_embriaguez BOOLEAN DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS condutor_cnh_vencida BOOLEAN DEFAULT false;

-- 3. Campos para tipo de local e documentação
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS tipo_local_evento VARCHAR(50); -- 'rodovia_federal', 'rodovia_estadual', 'urbana', 'sp_outros'
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS houve_vitima BOOLEAN DEFAULT false;

-- 4. Campos para prazos e validações
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS prazo_comunicado_dias INTEGER;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS data_prazo_documentos TIMESTAMP WITH TIME ZONE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS data_prazo_cota TIMESTAMP WITH TIME ZONE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS data_prazo_termo TIMESTAMP WITH TIME ZONE;

-- 5. Campos para cota de participação
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS valor_cota_participacao NUMERIC(10,2) DEFAULT 750.00;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS cota_paga BOOLEAN DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS cota_paga_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS cobranca_cota_id UUID;

-- 6. Campos para termo de anuência
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS termo_anuencia_assinado BOOLEAN DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS termo_anuencia_url TEXT;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS termo_anuencia_assinado_em TIMESTAMP WITH TIME ZONE;

-- 7. Campos para classificação de dano (regra 75% FIPE)
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS tipo_dano VARCHAR(20) DEFAULT 'parcial'; -- 'parcial', 'perda_total'
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS percentual_fipe NUMERIC(5,2);
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS valor_orcamento NUMERIC(12,2);

-- 8. Campos para recuperação (Roubo/Furto)
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS veiculo_recuperado BOOLEAN DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS veiculo_recuperado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS veiculo_recuperado_local TEXT;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS veiculo_recuperado_estado VARCHAR(50); -- 'sem_dano', 'dano_parcial', 'dano_total'

-- 9. Campos para garantia pós-reparo
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS data_garantia_inicio DATE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS data_garantia_fim DATE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS garantia_observacoes TEXT;

-- 10. Campos para sindicância e perícia
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS sindicante_id UUID REFERENCES profiles(id);
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS perito_id UUID REFERENCES profiles(id);
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS resultado_sindicancia VARCHAR(50); -- 'regular', 'irregular', 'inconclusivo'
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS resultado_pericia TEXT;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS sindicancia_prazo_fim DATE;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS motivo_analise_interna TEXT;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS motivo_suspensao TEXT;

-- 11. Campos para negação
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS motivo_negacao VARCHAR(100);
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS justificativa_negacao TEXT;

-- 12. Campo para vincular oficina/OS
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS oficina_id UUID;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS ordem_servico_id UUID;

-- 13. Índices para performance
CREATE INDEX IF NOT EXISTS idx_sinistros_condutor_relacao ON sinistros(condutor_relacao);
CREATE INDEX IF NOT EXISTS idx_sinistros_tipo_dano ON sinistros(tipo_dano);
CREATE INDEX IF NOT EXISTS idx_sinistros_sindicante ON sinistros(sindicante_id);
CREATE INDEX IF NOT EXISTS idx_sinistros_perito ON sinistros(perito_id);
CREATE INDEX IF NOT EXISTS idx_sinistros_oficina ON sinistros(oficina_id);

-- 14. Adicionar comentários explicativos
COMMENT ON COLUMN sinistros.condutor_relacao IS 'Relação do condutor com o associado: associado, terceiro_autorizado, terceiro';
COMMENT ON COLUMN sinistros.tipo_local_evento IS 'Tipo de local: rodovia_federal, rodovia_estadual, urbana, sp_outros';
COMMENT ON COLUMN sinistros.tipo_dano IS 'Classificação do dano: parcial (<75% FIPE) ou perda_total (>=75% FIPE)';
COMMENT ON COLUMN sinistros.resultado_sindicancia IS 'Resultado: regular (aprovado), irregular (fraude), inconclusivo';
COMMENT ON COLUMN sinistros.veiculo_recuperado_estado IS 'Estado do veículo recuperado: sem_dano, dano_parcial, dano_total';