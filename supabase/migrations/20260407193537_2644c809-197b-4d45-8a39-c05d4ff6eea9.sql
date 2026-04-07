-- Add visit result columns to manutencao_tratativas
ALTER TABLE manutencao_tratativas
  ADD COLUMN IF NOT EXISTS visita_data_hora timestamptz,
  ADD COLUMN IF NOT EXISTS visita_tecnico_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS visita_resultado text,
  ADD COLUMN IF NOT EXISTS visita_descricao text,
  ADD COLUMN IF NOT EXISTS rastreador_trocado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS imei_novo text,
  ADD COLUMN IF NOT EXISTS imei_retirado text,
  ADD COLUMN IF NOT EXISTS voltou_pontuar text;

-- Drop old check constraint if exists, then add updated one
DO $$
BEGIN
  ALTER TABLE manutencao_tratativas DROP CONSTRAINT IF EXISTS manutencao_tratativas_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add updated constraint with new statuses
ALTER TABLE manutencao_tratativas
  ADD CONSTRAINT manutencao_tratativas_status_check
  CHECK (status IN ('aguardando_contato', 'em_tratativa', 'agendado', 'resolvido_sem_visita', 'visita_realizada', 'acompanhamento'));