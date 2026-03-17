INSERT INTO comissoes_parametros (chave, valor, descricao, tipo_dado, ativo)
VALUES
  ('migracao_comprovantes_exigidos', '3', 'Quantidade de comprovantes de pagamento exigidos para migração', 'numero', true),
  ('migracao_prazo_resposta_horas', '48', 'Prazo em horas úteis para resposta da Praticcar', 'numero', true),
  ('migracao_canal_oficial', 'e-mail', 'Canal válido para solicitação de migração', 'texto', true),
  ('migracao_isentar_carencia', 'true', 'Se migrações aprovadas isentam carência', 'booleano', true);