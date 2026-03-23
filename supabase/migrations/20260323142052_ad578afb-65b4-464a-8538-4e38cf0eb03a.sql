INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES 
  ('jornada_limite_debito_horas', '0', 'numero', 'operacional', 'Limite de débito acumulado em horas para bloqueio de turno (0 = desativado)'),
  ('jornada_exibir_saldo_vistoriador', 'true', 'booleano', 'operacional', 'Exibir saldo de horas para o vistoriador no app')
ON CONFLICT (chave) DO NOTHING;