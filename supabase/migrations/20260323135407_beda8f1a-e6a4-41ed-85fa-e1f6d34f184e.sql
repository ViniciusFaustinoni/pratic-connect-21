INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES 
('sla_horas_instalacao', '48', 'numero', 'operacional', 'Prazo máximo em horas para instalações e vistorias'),
('sla_horas_manutencao', '24', 'numero', 'operacional', 'Prazo máximo em horas para manutenções e retiradas')
ON CONFLICT (chave) DO NOTHING;