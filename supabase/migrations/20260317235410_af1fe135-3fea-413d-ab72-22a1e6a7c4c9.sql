ALTER TABLE public.cotacoes ADD COLUMN indicador_id uuid REFERENCES public.associados(id) ON DELETE SET NULL;
ALTER TABLE public.cotacoes ADD COLUMN indicador_nome text;