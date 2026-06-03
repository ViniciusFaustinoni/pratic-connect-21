-- Sub-FIPE 3 vias: persistência da decisão "necessita rastreador?" no serviço
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS requer_rastreador_sub_fipe boolean,
  ADD COLUMN IF NOT EXISTS requer_rastreador_decidido_por uuid,
  ADD COLUMN IF NOT EXISTS requer_rastreador_decidido_em timestamptz;

COMMENT ON COLUMN public.servicos.requer_rastreador_sub_fipe IS
  'Sub-FIPE 3 vias — resposta do coordenador na atribuição: NULL=não respondido, true=incluir instalação de rastreador (exceção), false=apenas vistoria de fotos. Veículo permanece enquadrado como sub-FIPE.';
COMMENT ON COLUMN public.servicos.requer_rastreador_decidido_por IS
  'profile.id do coordenador que respondeu a pergunta sub-FIPE.';
COMMENT ON COLUMN public.servicos.requer_rastreador_decidido_em IS
  'Timestamp da decisão sub-FIPE.';