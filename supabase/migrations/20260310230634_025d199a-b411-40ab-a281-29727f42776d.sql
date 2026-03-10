
-- Remover constraint antiga e recriar com novos tipos
ALTER TABLE coberturas DROP CONSTRAINT coberturas_tipo_check;

ALTER TABLE coberturas ADD CONSTRAINT coberturas_tipo_check 
CHECK (tipo::text = ANY (ARRAY[
  'colisao','roubo_furto','incendio','alagamento','vidros',
  'terceiros','app','assistencia','carro_reserva',
  'protecao_financeira','rastreamento','morte_acidental',
  'granizo','perda_total'
]::text[]));

-- Inserir as coberturas faltantes
INSERT INTO coberturas (codigo, nome, tipo, percentual_cobertura, carencia_dias)
VALUES 
  ('COB-GRA', 'Chuva de Granizo', 'granizo', 100, 30),
  ('COB-PT',  'Perda Total',      'perda_total', 100, 30)
ON CONFLICT (codigo) DO NOTHING;
