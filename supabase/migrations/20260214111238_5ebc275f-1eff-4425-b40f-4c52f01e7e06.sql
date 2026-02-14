
ALTER TABLE evento_cotacoes_pecas 
  ADD COLUMN IF NOT EXISTS aprovada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovada_por uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_geral text,
  ADD COLUMN IF NOT EXISTS observacoes_auto_center text;
