-- Adicionar colunas para controle de envio da Apólice de Passageiros (APP)
ALTER TABLE public.contratos 
  ADD COLUMN IF NOT EXISTS app_apolice_enviada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_apolice_enviada_em timestamptz DEFAULT null;