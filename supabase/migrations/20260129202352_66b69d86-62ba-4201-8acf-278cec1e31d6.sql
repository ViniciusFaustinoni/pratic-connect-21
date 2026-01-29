-- Adicionar colunas para controlar lembretes pós-vencimento em asaas_cobrancas
-- Isso permite múltiplos lembretes por cobrança (D+1, D+3, D+5)

ALTER TABLE public.asaas_cobrancas 
ADD COLUMN IF NOT EXISTS lembrete_d1_enviado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lembrete_d3_enviado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS lembrete_d5_enviado BOOLEAN DEFAULT FALSE;

-- Comentários para documentação
COMMENT ON COLUMN public.asaas_cobrancas.lembrete_d1_enviado IS 'Lembrete D+1 (1 dia após vencimento) enviado';
COMMENT ON COLUMN public.asaas_cobrancas.lembrete_d3_enviado IS 'Lembrete D+3 (3 dias após vencimento) enviado';
COMMENT ON COLUMN public.asaas_cobrancas.lembrete_d5_enviado IS 'Lembrete D+5 (5 dias após vencimento, suspensão iminente) enviado';