ALTER TABLE public.user_module_visibility REPLICA IDENTITY FULL;
ALTER TABLE public.user_module_item_visibility REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_module_visibility;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_module_item_visibility;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;