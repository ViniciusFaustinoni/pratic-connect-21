
ALTER TABLE public.manutencao_tratativas
  ADD COLUMN IF NOT EXISTS endereco_tipo text,
  ADD COLUMN IF NOT EXISTS endereco_texto text,
  ADD COLUMN IF NOT EXISTS endereco_referencia text,
  ADD COLUMN IF NOT EXISTS periodo_agendamento text,
  ADD COLUMN IF NOT EXISTS tecnico_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS tipos_ocorrencia text[],
  ADD COLUMN IF NOT EXISTS observacoes_tecnico text,
  ADD COLUMN IF NOT EXISTS taxa_visita_aplicar boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS taxa_visita_observacao text,
  ADD COLUMN IF NOT EXISTS servico_id uuid REFERENCES public.servicos(id);
