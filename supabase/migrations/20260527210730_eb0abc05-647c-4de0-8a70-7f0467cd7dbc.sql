CREATE TABLE IF NOT EXISTS public.whatsapp_conversa_leituras (
  user_id uuid NOT NULL,
  telefone varchar NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, telefone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversa_leituras TO authenticated;
GRANT ALL ON public.whatsapp_conversa_leituras TO service_role;

ALTER TABLE public.whatsapp_conversa_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operador_le_proprias_leituras" ON public.whatsapp_conversa_leituras
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "operador_insere_proprias_leituras" ON public.whatsapp_conversa_leituras
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "operador_atualiza_proprias_leituras" ON public.whatsapp_conversa_leituras
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "operador_deleta_proprias_leituras" ON public.whatsapp_conversa_leituras
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.fn_whatsapp_conversa_leituras_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversa_leituras_touch ON public.whatsapp_conversa_leituras;
CREATE TRIGGER trg_whatsapp_conversa_leituras_touch
  BEFORE UPDATE ON public.whatsapp_conversa_leituras
  FOR EACH ROW EXECUTE FUNCTION public.fn_whatsapp_conversa_leituras_touch();