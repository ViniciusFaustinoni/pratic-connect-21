ALTER TABLE public.servicos
  ADD CONSTRAINT servicos_instalacao_origem_id_fkey
  FOREIGN KEY (instalacao_origem_id) REFERENCES public.instalacoes(id) ON DELETE SET NULL;

ALTER TABLE public.servicos
  ADD CONSTRAINT servicos_vistoria_origem_id_fkey
  FOREIGN KEY (vistoria_origem_id) REFERENCES public.vistorias(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';