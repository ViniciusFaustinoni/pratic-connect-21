DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='agendamentos_base'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos_base';
  END IF;
END $$;
ALTER TABLE public.agendamentos_base REPLICA IDENTITY FULL;