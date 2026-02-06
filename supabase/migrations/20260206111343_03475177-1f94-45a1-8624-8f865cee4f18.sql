-- Adicionar coluna para registrar minutos de atraso no retorno do almoço
ALTER TABLE turnos_profissionais 
ADD COLUMN IF NOT EXISTS minutos_atraso_almoco INTEGER DEFAULT 0;

COMMENT ON COLUMN turnos_profissionais.minutos_atraso_almoco IS 
  'Minutos de atraso no retorno do almoço. Será acrescido à jornada restante.';