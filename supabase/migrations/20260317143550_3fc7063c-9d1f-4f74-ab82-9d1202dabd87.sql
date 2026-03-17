INSERT INTO comissoes_parametros (chave, valor, descricao, tipo_dado, ativo)
VALUES
  ('repasse_maior_corte_boletos', '4', 'Quantidade de boletos pagos que separa os dois grupos de associados', 'numero', true),
  ('repasse_maior_pct_favoravel', '50', 'Percentual mínimo do débito para grupo com bom histórico', 'numero', true),
  ('repasse_maior_valor_favoravel', '100', 'Valor mínimo em reais para grupo com bom histórico', 'numero', true),
  ('repasse_maior_pct_reduzido', '70', 'Percentual mínimo do débito para grupo com histórico reduzido', 'numero', true),
  ('repasse_maior_valor_reduzido', '150', 'Valor mínimo em reais para grupo com histórico reduzido', 'numero', true);