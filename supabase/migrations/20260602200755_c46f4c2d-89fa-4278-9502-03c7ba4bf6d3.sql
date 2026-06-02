-- Rodada 1: promove status das vistorias TTA5H86 (id 91548d1a) e SSA3G29 (id a6f26295)
-- de 'agendada' para 'aprovada' para alinhar com servicos.status já aprovado
-- e tornar elegível ao filtro do sga-hinova-sync (status IN concluida/aprovada/em_analise).
UPDATE public.vistorias
SET status = 'aprovada',
    updated_at = now()
WHERE id IN (
  '91548d1a-c968-4a97-bc23-4e1be5ff2c25',
  'a6f26295-4023-412a-b033-ee11315128d1'
)
AND status = 'agendada';