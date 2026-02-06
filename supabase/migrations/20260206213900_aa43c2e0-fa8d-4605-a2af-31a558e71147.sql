-- ============================================
-- MIGRAÇÃO: Campos específicos para Vistoria de Manutenção
-- Adiciona colunas na tabela servicos para suportar o workflow completo
-- ============================================

-- Campo para motivo da manutenção
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS motivo_manutencao text;

-- Campo para detalhes adicionais do motivo
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS motivo_detalhe text;

-- Campo para tipo de local (base, ponto_instalacao, rota)
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS local_tipo_manutencao text;

-- Campo para indicar se proteção foi suspensa (quando associado não comparece em 48h)
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS protecao_suspensa boolean DEFAULT false;

-- Campo para data/hora da suspensão de proteção
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS data_suspensao timestamptz;

-- Campo para rastreador substituto (quando há substituição)
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS rastreador_substituto_id uuid REFERENCES public.rastreadores(id);

-- Campo para resultado da manutenção (resolvido ou substituicao)
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS resultado_manutencao text;

-- Adicionar status 'nao_compareceu' se não existir
-- (Comentado pois pode já existir via constraints ou enum)
-- Usaremos o campo protecao_suspensa + status cancelada/reagendada

-- Índices para performance nas consultas de manutenção
CREATE INDEX IF NOT EXISTS idx_servicos_motivo_manutencao 
ON public.servicos(motivo_manutencao) 
WHERE tipo = 'vistoria_manutencao';

CREATE INDEX IF NOT EXISTS idx_servicos_local_tipo_manutencao 
ON public.servicos(local_tipo_manutencao) 
WHERE tipo = 'vistoria_manutencao';

CREATE INDEX IF NOT EXISTS idx_servicos_protecao_suspensa 
ON public.servicos(protecao_suspensa) 
WHERE protecao_suspensa = true;

CREATE INDEX IF NOT EXISTS idx_servicos_rastreador_substituto 
ON public.servicos(rastreador_substituto_id) 
WHERE rastreador_substituto_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.servicos.motivo_manutencao IS 'Motivo da manutenção: sem_sinal, bateria_baixa, gps_incorreto, alarme_desconexao, verificacao_periodica, suspeita_violacao, outro';
COMMENT ON COLUMN public.servicos.motivo_detalhe IS 'Detalhes adicionais sobre o motivo da manutenção';
COMMENT ON COLUMN public.servicos.local_tipo_manutencao IS 'Tipo de local: base (associado vem), ponto_instalacao, rota (técnico vai)';
COMMENT ON COLUMN public.servicos.protecao_suspensa IS 'Indica se proteção foi suspensa por não comparecimento (48h)';
COMMENT ON COLUMN public.servicos.data_suspensao IS 'Data/hora em que a proteção foi suspensa';
COMMENT ON COLUMN public.servicos.rastreador_substituto_id IS 'ID do novo rastreador quando houve substituição';
COMMENT ON COLUMN public.servicos.resultado_manutencao IS 'Resultado: resolvido (mantém rastreador) ou substituicao (troca rastreador)';