INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('marcas_aceitas_motos', '["Honda", "Yamaha", "Shineray", "BMW", "Haojue", "Suzuki"]', 'json', 'operacional', 'Marcas de moto aceitas para cotação na Linha Advanced', true)
ON CONFLICT (chave) DO NOTHING;