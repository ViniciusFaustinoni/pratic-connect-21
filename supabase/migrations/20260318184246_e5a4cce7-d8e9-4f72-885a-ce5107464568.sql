INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES (
  'categorias_que_sobrepoe_app',
  '["chassi_remarcado","placa_vermelha","ex_taxi","taxi","leilao","ressarcimento_integral"]',
  'json',
  'operacional',
  'Categorias de deságio que anulam o adicional APP na precificação'
) ON CONFLICT (chave) DO NOTHING;