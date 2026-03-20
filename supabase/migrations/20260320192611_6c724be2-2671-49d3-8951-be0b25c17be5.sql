INSERT INTO configuracoes (chave, valor, descricao, categoria, tipo, editavel) VALUES
  ('fila_raio_proximidade_metros', '500', 'Raio em metros para enfileirar serviço em profissional ocupado', 'operacional', 'numero', true),
  ('fila_raio_quase_disponivel_metros', '1000', 'Raio ampliado em metros quando profissional está há 75+ min na tarefa', 'operacional', 'numero', true),
  ('fila_max_por_profissional', '3', 'Máximo de serviços enfileirados por profissional', 'operacional', 'numero', true),
  ('fila_tempo_expiracao_horas', '4', 'Tempo em horas até item da fila expirar', 'operacional', 'numero', true),
  ('redistribuicao_raio_km', '5', 'Raio em km para buscar substituto em imprevisto do instalador', 'operacional', 'numero', true)
ON CONFLICT (chave) DO NOTHING;