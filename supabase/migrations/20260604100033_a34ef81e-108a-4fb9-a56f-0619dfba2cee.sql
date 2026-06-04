-- Realtime para o painel de Chat IA
ALTER TABLE public.whatsapp_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_ia_pausas REPLICA IDENTITY FULL;

-- Adiciona à publication (idempotente: ignora se já estiver)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_ia_pausas;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;