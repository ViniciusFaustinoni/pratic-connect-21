-- Confirmação de leitura no chat IA: coluna para evitar re-disparo de markAsRead
ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS lida_pelo_operador_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_entrada_nao_lida_operador
  ON public.whatsapp_mensagens (telefone, created_at)
  WHERE direcao = 'entrada' AND lida_pelo_operador_em IS NULL;

COMMENT ON COLUMN public.whatsapp_mensagens.lida_pelo_operador_em IS
  'Timestamp em que a mensagem de entrada foi vista pelo operador no chat IA e teve markAsRead disparado ao provedor (Evolution/Meta). NÃO confundir com read_at, que é a leitura do destinatário no WhatsApp dele.';