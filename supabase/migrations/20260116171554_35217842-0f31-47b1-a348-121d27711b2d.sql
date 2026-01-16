-- Limpar dados existentes
DELETE FROM beneficios_adicionais;

-- Inserir benefícios corretos
INSERT INTO beneficios_adicionais (codigo, nome, categoria, descricao, preco, ativo, ordem) VALUES
('REBOQUE_1000KM', '1000km Reboque', 'Reboque', 'Amplia cobertura de reboque', 2.90, true, 1),
('TERCEIROS_15', 'Danos Terceiros 15mil', 'Terceiros', 'Cobertura para danos a terceiros', 12.90, true, 2),
('TERCEIROS_70', 'Danos Terceiros 70mil', 'Terceiros', 'Cobertura ampliada', 20.00, true, 3),
('TERCEIROS_100', 'Danos Terceiros 100mil', 'Terceiros', 'Cobertura máxima', 40.00, true, 4),
('VIDROS_FAROIS', 'Vidros e Faróis', 'Vidros', '60% do reparo (carência 120 dias)', 9.90, true, 5),
('KIT_GAS', 'Kit Gás', 'Kit', 'Até R$2.200 em caso de roubo', 9.90, true, 6),
('REBOQUE_EXCEDENTE', 'Reboque Excedente', 'Reboque', '1 utilização a cada 6 meses (máx 2x/ano)', 2.90, true, 7),
('CLUBE_GAS', 'Clube Gás', 'Combustivel', 'Até 10% desconto combustível', 10.00, true, 8),
('PROTECAO_PASSAGEIROS', 'Proteção Passageiros', 'Passageiros', 'APP exclusivo', 4.90, true, 9),
('RASTREADOR', 'Rastreador', 'Rastreador', 'Monitoramento em tempo real', 30.00, true, 10),
('CARRO_RESERVA_7', 'Carro Reserva 7 dias', 'Reserva', 'Reembolso locação (somente em casos de colisão)', 7.90, true, 11),
('CARRO_RESERVA_15', 'Carro Reserva 15 dias', 'Reserva', 'Reembolso locação (somente em casos de colisão)', 15.90, true, 12),
('CARRO_RESERVA_30', 'Carro Reserva 30 dias', 'Reserva', 'Reembolso até R$2.200 (somente em casos de colisão)', 35.90, true, 13),
('COMBO_APP_CARRO', '100% FIPE APP + Carro 30d', 'Combo', 'Combo exclusivo APP (carro reserva somente em casos de colisão)', 35.90, true, 14);