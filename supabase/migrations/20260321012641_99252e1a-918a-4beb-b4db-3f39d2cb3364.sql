INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES
  ('operacional_encaixe_ativo', 'true', 'booleano', 'operacional', 'Habilita/desabilita o sistema de encaixe'),
  ('fila_atribuicao_ativa', 'true', 'booleano', 'operacional', 'Habilita/desabilita a atribuição automática de tarefas')
ON CONFLICT (chave) DO NOTHING;