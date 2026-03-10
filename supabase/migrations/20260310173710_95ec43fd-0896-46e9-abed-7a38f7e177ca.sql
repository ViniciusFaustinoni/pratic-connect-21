CREATE TABLE IF NOT EXISTS plano_preco_map (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id       uuid NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
  linha_slug     varchar(50) NOT NULL,
  tipo_uso       varchar(30) NOT NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plano_preco_map_plano_id
  ON plano_preco_map(plano_id);

CREATE INDEX IF NOT EXISTS idx_plano_preco_map_linha_slug
  ON plano_preco_map(linha_slug);