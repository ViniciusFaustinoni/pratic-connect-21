CREATE TABLE IF NOT EXISTS public.sga_fotos_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL,
  codigo_veiculo_hinova bigint NOT NULL,
  origem text NOT NULL,
  origem_id text NOT NULL,
  arquivo_url text NOT NULL,
  codigo_tipo int NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  hinova_response jsonb,
  CONSTRAINT sga_fotos_enviadas_uq UNIQUE (veiculo_id, origem, origem_id)
);
CREATE INDEX IF NOT EXISTS sga_fotos_enviadas_veiculo_idx ON public.sga_fotos_enviadas (veiculo_id);
ALTER TABLE public.sga_fotos_enviadas ENABLE ROW LEVEL SECURITY;
-- Sem policies: somente service_role (edge functions) lê/escreve.