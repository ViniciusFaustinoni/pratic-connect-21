-- Passo 1: Novas colunas em associados
ALTER TABLE associados 
ADD COLUMN IF NOT EXISTS pode_reativar boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS tipo_saida varchar(50),
ADD COLUMN IF NOT EXISTS data_efetiva_saida timestamptz,
ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS boleto_final_gerado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS asaas_recorrencia_cancelada boolean DEFAULT false;

COMMENT ON COLUMN associados.pode_reativar IS 'Se o associado pode reativar mediante quitação de débitos';
COMMENT ON COLUMN associados.tipo_saida IS 'cancelamento_voluntario, inadimplencia, exclusao_diretoria, busca_apreensao';
COMMENT ON COLUMN associados.data_efetiva_saida IS 'Data efetiva da saída (= data devolução do rastreador)';

-- Passo 2: Novas colunas em associados_historico
ALTER TABLE associados_historico
ADD COLUMN IF NOT EXISTS acao varchar(50),
ADD COLUMN IF NOT EXISTS status_anterior varchar(50),
ADD COLUMN IF NOT EXISTS status_novo varchar(50),
ADD COLUMN IF NOT EXISTS motivo text,
ADD COLUMN IF NOT EXISTS executado_por uuid REFERENCES auth.users(id);

COMMENT ON COLUMN associados_historico.acao IS 'suspensao, reativacao, cancelamento, exclusao, substituicao';