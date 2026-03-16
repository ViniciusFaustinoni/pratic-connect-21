INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES (
  'regioes_com_adicional_app',
  '["rj","lagos"]',
  'texto',
  'empresa',
  'Regiões onde o uso como aplicativo exige adicional mensal para cobertura 100% FIPE'
)
ON CONFLICT (chave) DO NOTHING;