-- Índices faltantes na tabela associados (alvo: reduzir seq_scan de 99.5%)
CREATE INDEX IF NOT EXISTS idx_associados_user_id ON public.associados USING btree (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_associados_created_at ON public.associados USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_associados_plano_id ON public.associados USING btree (plano_id) WHERE plano_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_associados_contrato_id ON public.associados USING btree (contrato_id) WHERE contrato_id IS NOT NULL;
-- Índice composto para listagens filtradas por status + ordenadas por data
CREATE INDEX IF NOT EXISTS idx_associados_status_created ON public.associados USING btree (status, created_at DESC);

ANALYZE public.associados;