INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('tipos_uso',
  '[{"value":"particular","label":"Particular"},{"value":"aplicativo","label":"Aplicativo (Uber, 99, etc)"},{"value":"comercial","label":"Comercial"},{"value":"moto","label":"Moto"}]',
  'json',
  'operacional',
  'Tipos de uso do veículo (usado em planos e cotações)')
ON CONFLICT (chave) DO NOTHING;