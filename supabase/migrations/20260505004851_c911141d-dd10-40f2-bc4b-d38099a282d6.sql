
-- Índices para acelerar listagens críticas (cotações, associados, veículos, contratos)
CREATE INDEX IF NOT EXISTS idx_cotacoes_vendedor_created
  ON public.cotacoes (vendedor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cotacoes_created
  ON public.cotacoes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cotacoes_lead_id
  ON public.cotacoes (lead_id);

CREATE INDEX IF NOT EXISTS idx_associados_status_created
  ON public.associados (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_associados_created
  ON public.associados (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_associados_plano
  ON public.associados (plano_id);

CREATE INDEX IF NOT EXISTS idx_veiculos_associado_created
  ON public.veiculos (associado_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_veiculos_placa
  ON public.veiculos (placa);

CREATE INDEX IF NOT EXISTS idx_contratos_associado
  ON public.contratos (associado_id);

CREATE INDEX IF NOT EXISTS idx_contratos_vendedor
  ON public.contratos (vendedor_id);

CREATE INDEX IF NOT EXISTS idx_contratos_cotacao
  ON public.contratos (cotacao_id);

CREATE INDEX IF NOT EXISTS idx_instalacoes_cotacao
  ON public.instalacoes (cotacao_id);
