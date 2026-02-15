
ALTER TABLE public.processos_prazos
  ADD COLUMN IF NOT EXISTS tipo varchar DEFAULT 'judicial',
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES sinistros(id),
  ADD COLUMN IF NOT EXISTS hora_vencimento time,
  ADD COLUMN IF NOT EXISTS alerta_enviado_7d boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_dias integer[] DEFAULT '{7,3,1}',
  ADD COLUMN IF NOT EXISTS prorrogado_de date,
  ADD COLUMN IF NOT EXISTS prorrogacao_motivo text,
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text;
