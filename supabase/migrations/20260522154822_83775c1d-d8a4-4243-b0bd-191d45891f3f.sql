
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS intencao_rastreador_imei TEXT,
  ADD COLUMN IF NOT EXISTS intencao_rastreador_rastreador_id UUID REFERENCES public.rastreadores(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.servicos.intencao_rastreador_imei IS
  'IMEI esperado do rastreador quando o serviço foi marcado como manutenção pelo Monitoramento (fallback "Tratar como Manutenção"). Usado para banner no app do instalador.';

COMMENT ON COLUMN public.servicos.intencao_rastreador_rastreador_id IS
  'Rastreador (linha local em public.rastreadores) que o Monitoramento associou ao marcar manutenção. Quando preenchido, o vínculo já foi materializado.';

CREATE INDEX IF NOT EXISTS idx_servicos_intencao_rastreador_imei
  ON public.servicos (intencao_rastreador_imei)
  WHERE intencao_rastreador_imei IS NOT NULL;
