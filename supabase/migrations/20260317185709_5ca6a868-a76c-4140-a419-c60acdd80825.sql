
-- 1. Add columns to contratos for carência tracking
ALTER TABLE public.contratos 
  ADD COLUMN IF NOT EXISTS tipo_entrada varchar DEFAULT 'nova',
  ADD COLUMN IF NOT EXISTS data_carencia_inicio date,
  ADD COLUMN IF NOT EXISTS data_carencia_fim date,
  ADD COLUMN IF NOT EXISTS carencia_isenta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS carencia_motivo_isencao text;

-- 2. Create operacao_config_snapshot table
CREATE TABLE IF NOT EXISTS public.operacao_config_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE CASCADE,
  associado_id uuid REFERENCES public.associados(id) ON DELETE CASCADE,
  tipo_operacao varchar NOT NULL,
  config_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operacao_config_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON public.operacao_config_snapshot FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert snapshots"
  ON public.operacao_config_snapshot FOR INSERT
  TO authenticated WITH CHECK (true);

-- 3. Insert inadimplência parameter keys
INSERT INTO public.comissoes_parametros (chave, valor, descricao, tipo_dado, ativo)
VALUES 
  ('inadimplencia_prazo_sem_revistoria', '30', 'Dias de atraso sem necessidade de revistoria', 'numero', true),
  ('inadimplencia_prazo_revistoria', '90', 'Dias de atraso que exigem revistoria para reativação', 'numero', true),
  ('inadimplencia_prazo_nova_adesao', '180', 'Dias de atraso que exigem nova adesão completa', 'numero', true)
ON CONFLICT DO NOTHING;

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_operacao_config_snapshot_contrato ON public.operacao_config_snapshot(contrato_id);
CREATE INDEX IF NOT EXISTS idx_operacao_config_snapshot_associado ON public.operacao_config_snapshot(associado_id);
