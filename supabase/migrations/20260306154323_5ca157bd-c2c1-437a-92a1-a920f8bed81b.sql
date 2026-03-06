-- 1. Add em_analise to status_instalacao enum
ALTER TYPE status_instalacao ADD VALUE IF NOT EXISTS 'em_analise';

-- 2. Update sync trigger to map em_analise correctly
CREATE OR REPLACE FUNCTION sync_servicos_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    UPDATE instalacoes
    SET 
      status = CASE 
        WHEN NEW.status::text IN ('agendada', 'em_rota', 'em_andamento', 'concluida', 'reagendada', 'cancelada', 'em_analise') 
        THEN (NEW.status::text)::status_instalacao
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.instalacao_origem_id
      AND status::text IS DISTINCT FROM NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;