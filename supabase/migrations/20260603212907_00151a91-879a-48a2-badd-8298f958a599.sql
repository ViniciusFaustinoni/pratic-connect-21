ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS ultima_msg_fora_horario_em timestamptz;