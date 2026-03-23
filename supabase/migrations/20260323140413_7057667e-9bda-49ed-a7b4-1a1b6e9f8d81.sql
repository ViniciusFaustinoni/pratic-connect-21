CREATE TABLE IF NOT EXISTS registros_presenca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid REFERENCES servicos(id) ON DELETE CASCADE NOT NULL,
  latitude_vistoriador double precision,
  longitude_vistoriador double precision,
  latitude_destino double precision,
  longitude_destino double precision,
  distancia_metros double precision,
  dentro_do_raio boolean DEFAULT false,
  confirmou_presenca boolean DEFAULT false,
  gps_indisponivel boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE registros_presenca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert registros_presenca"
  ON registros_presenca FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can select registros_presenca"
  ON registros_presenca FOR SELECT TO authenticated
  USING (true);

INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES
('gps_validacao_ativa', 'true', 'booleano', 'operacional', 'Exigir validação de localização GPS ao iniciar serviço'),
('gps_raio_metros', '500', 'numero', 'operacional', 'Raio máximo de tolerância em metros para validação GPS')
ON CONFLICT (chave) DO NOTHING;