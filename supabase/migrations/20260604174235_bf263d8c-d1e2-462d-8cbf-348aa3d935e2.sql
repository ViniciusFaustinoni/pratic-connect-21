CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_mensagens_saida_message_id_v1
  ON public.whatsapp_mensagens (message_id)
  WHERE direcao = 'saida'
    AND message_id IS NOT NULL
    AND created_at >= TIMESTAMPTZ '2026-06-05 00:00:00+00';