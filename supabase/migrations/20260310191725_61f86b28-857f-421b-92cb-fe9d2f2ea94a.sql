INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES 
  ('multa_inadimplencia', '0.02', 'percentual', 'financeiro', 'Percentual de multa por inadimplência (ex: 0.02 = 2%)'),
  ('juros_mes_inadimplencia', '0.01', 'percentual', 'financeiro', 'Percentual de juros mensais por inadimplência (ex: 0.01 = 1%)'),
  ('limite_dano_parcial_fipe', '0.75', 'percentual', 'operacional', 'Percentual do FIPE para classificar como perda total (ex: 0.75 = 75%)')
ON CONFLICT (chave) DO NOTHING;