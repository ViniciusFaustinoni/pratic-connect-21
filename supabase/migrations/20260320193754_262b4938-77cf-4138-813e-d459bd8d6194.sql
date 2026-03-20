INSERT INTO configuracoes (chave, valor, descricao, categoria, tipo)
VALUES 
  ('fila_etapa_quase_disponivel', '4', 'Etapa mínima do processo para considerar profissional quase disponível (1=Dados, 2=Checklist, 3=Fotos, 4=Assinatura, 5=Decisão)', 'monitoramento', 'numero'),
  ('fila_tempo_quase_disponivel_min', '75', 'Tempo mínimo em minutos na tarefa para considerar profissional quase disponível', 'monitoramento', 'numero')
ON CONFLICT (chave) DO NOTHING;