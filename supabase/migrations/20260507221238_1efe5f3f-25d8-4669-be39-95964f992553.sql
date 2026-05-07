ALTER TABLE public.solicitacoes_troca_titularidade
  ADD COLUMN IF NOT EXISTS termo_whatsapp_status text,
  ADD COLUMN IF NOT EXISTS termo_reenvios_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS termo_ultimo_reenvio_em timestamptz;

COMMENT ON COLUMN public.solicitacoes_troca_titularidade.termo_whatsapp_status IS 'Status do disparo WhatsApp do termo: enviado | falhou | sem_telefone';
COMMENT ON COLUMN public.solicitacoes_troca_titularidade.termo_reenvios_count IS 'Quantidade de reenvios do termo (cada reenvio cancela o doc anterior no Autentique e cria um novo)';