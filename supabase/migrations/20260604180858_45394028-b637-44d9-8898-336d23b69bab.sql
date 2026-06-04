ALTER TABLE public.ia_habilidades
  ADD COLUMN IF NOT EXISTS mensagem_pos_identificacao text,
  ADD COLUMN IF NOT EXISTS gate_saudacao_horas numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS gate_saudacao_aplicar_identificados boolean NOT NULL DEFAULT true;