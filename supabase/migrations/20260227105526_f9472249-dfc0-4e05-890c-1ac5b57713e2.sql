INSERT INTO configuracoes (chave, valor, descricao, tipo, categoria)
VALUES ('operacional_fipe_minimo_rastreador_moto', '9000', 'Valor FIPE mínimo para exigir instalação de rastreador em motos. Motos abaixo deste valor dispensam rastreador.', 'moeda', 'operacional')
ON CONFLICT (chave) DO NOTHING;