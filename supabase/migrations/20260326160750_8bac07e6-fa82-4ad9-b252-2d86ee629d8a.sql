
INSERT INTO configuracoes (chave, valor, tipo, categoria)
VALUES ('tipos_placa', '[{"value":"mercosul","label":"Mercosul"},{"value":"antiga","label":"Antiga"},{"value":"especial","label":"Especial"}]', 'json', 'operacional')
ON CONFLICT (chave) DO NOTHING;
