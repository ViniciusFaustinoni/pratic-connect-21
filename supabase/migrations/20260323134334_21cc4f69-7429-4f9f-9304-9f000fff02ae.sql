INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES 
('jornada_duracao_turno_horas', '8', 'numero', 'operacional', 'Duração total do turno em horas'),
('jornada_horas_ate_almoco', '4', 'numero', 'operacional', 'Horas trabalhadas até o almoço automático'),
('jornada_duracao_almoco_minutos', '60', 'numero', 'operacional', 'Duração do intervalo de almoço em minutos'),
('jornada_tolerancia_atraso_minutos', '0', 'numero', 'operacional', 'Tolerância de atraso no retorno do almoço em minutos'),
('jornada_produtividade_minima', '1', 'numero', 'operacional', 'Quantidade mínima de serviços por turno'),
('jornada_horas_alerta_improdutividade', '2', 'numero', 'operacional', 'Horas de turno ativo sem serviço para gerar alerta')
ON CONFLICT (chave) DO NOTHING;