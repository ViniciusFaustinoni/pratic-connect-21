
INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
VALUES
  ('tipo_foto', 'contrato_assinado',   0, 'CONTRATO/TERMO DE FILIAÇÃO — aguardando código oficial da Hinova', false),
  ('tipo_foto', 'termo_filiacao',      0, 'CONTRATO/TERMO DE FILIAÇÃO (alias) — aguardando código oficial da Hinova', false),
  ('tipo_foto', 'contrato',            0, 'CONTRATO/TERMO DE FILIAÇÃO (alias) — aguardando código oficial da Hinova', false),
  ('tipo_foto', 'nota_fiscal_veiculo', 0, 'NOTA FISCAL DO VEÍCULO — aguardando código oficial da Hinova', false),
  ('tipo_foto', 'nota_fiscal',         0, 'NOTA FISCAL DO VEÍCULO (alias) — aguardando código oficial da Hinova', false)
ON CONFLICT (tipo, codigo_local) DO NOTHING;
