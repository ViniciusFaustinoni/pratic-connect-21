
-- =============================================
-- EXPANSÃO DO PLANO DE CONTAS + RENOMEAÇÕES
-- =============================================

-- ETAPA 1: Renomear contas existentes
UPDATE plano_contas SET descricao = 'PATRIMÔNIO SOCIAL' WHERE id = '96133076-b9ba-4f62-9005-64d044cb1622';
UPDATE plano_contas SET descricao = 'Patrimônio Social Inicial' WHERE id = '80f6f4f3-f3aa-4afe-a68b-c441ba4b1700';
UPDATE plano_contas SET descricao = 'Superávits/Déficits Acumulados' WHERE id = '8cda4932-e2ab-4a6c-9451-a573123f957f';
UPDATE plano_contas SET descricao = 'PIS a Recolher' WHERE id = 'fb4a9600-a484-4076-96ee-dc5d4197d967';

-- ETAPA 2: Inserir novas contas

-- GRUPO 1 - ATIVO
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('1.1.01.003', 'Banco Conta Movimento (Bradesco)', 'ativo', 'devedora', false, true, true, 4, 103, 'c36931b6-21a2-4cf4-a8e9-5286d6a3876c'),
('1.1.01.004', 'Aplicações Financeiras de Liquidez Imediata', 'ativo', 'devedora', false, true, true, 4, 104, 'c36931b6-21a2-4cf4-a8e9-5286d6a3876c'),
('1.1.01.005', 'Conta ASAAS (Gateway)', 'ativo', 'devedora', false, true, true, 4, 105, 'c36931b6-21a2-4cf4-a8e9-5286d6a3876c'),
('1.1.02.003', 'Cotas de Eventos a Receber', 'ativo', 'devedora', false, true, true, 4, 123, 'fc215e26-478a-4cb2-a3f4-f6a1029cd458'),
('1.1.02.004', 'Outras Receitas a Receber', 'ativo', 'devedora', false, true, true, 4, 124, 'fc215e26-478a-4cb2-a3f4-f6a1029cd458'),
('1.1.02.005', '(-) Provisão para Devedores Duvidosos (PDD)', 'ativo', 'devedora', false, true, true, 4, 125, 'fc215e26-478a-4cb2-a3f4-f6a1029cd458');

-- Adiantamentos
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a1000001-0000-0000-0000-000000000001', '1.1.03', 'Adiantamentos e Depósitos', 'ativo', 'devedora', true, false, true, 3, 130, '54409fc7-df92-413b-bf7b-d8dc2b2c2616');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('1.1.03.001', 'Adiantamento a Fornecedores', 'ativo', 'devedora', false, true, true, 4, 131, 'a1000001-0000-0000-0000-000000000001'),
('1.1.03.002', 'Adiantamento a Funcionários', 'ativo', 'devedora', false, true, true, 4, 132, 'a1000001-0000-0000-0000-000000000001'),
('1.1.03.003', 'Despesas Pagas Antecipadamente', 'ativo', 'devedora', false, true, true, 4, 133, 'a1000001-0000-0000-0000-000000000001');

-- Estoques
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a1000002-0000-0000-0000-000000000001', '1.1.04', 'Estoques', 'ativo', 'devedora', true, false, true, 3, 140, '54409fc7-df92-413b-bf7b-d8dc2b2c2616');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('1.1.04.001', 'Rastreadores em Estoque', 'ativo', 'devedora', false, true, true, 4, 141, 'a1000002-0000-0000-0000-000000000001'),
('1.1.04.002', 'Salvados', 'ativo', 'devedora', false, true, true, 4, 142, 'a1000002-0000-0000-0000-000000000001');

-- Ativo Não Circulante
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a1000003-0000-0000-0000-000000000001', '1.2', 'ATIVO NÃO CIRCULANTE', 'ativo', 'devedora', true, false, true, 2, 200, '4a447412-59c0-4e18-90c3-174ac229a103');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a1000004-0000-0000-0000-000000000001', '1.2.01', 'Imobilizado', 'ativo', 'devedora', true, false, true, 3, 210, 'a1000003-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('1.2.01.001', 'Móveis e Utensílios', 'ativo', 'devedora', false, true, true, 4, 211, 'a1000004-0000-0000-0000-000000000001'),
('1.2.01.002', 'Equipamentos de Informática', 'ativo', 'devedora', false, true, true, 4, 212, 'a1000004-0000-0000-0000-000000000001'),
('1.2.01.003', 'Veículos da Associação', 'ativo', 'devedora', false, true, true, 4, 213, 'a1000004-0000-0000-0000-000000000001'),
('1.2.01.004', 'Instalações e Benfeitorias', 'ativo', 'devedora', false, true, true, 4, 214, 'a1000004-0000-0000-0000-000000000001'),
('1.2.01.005', '(-) Depreciação Acumulada', 'ativo', 'devedora', false, true, true, 4, 215, 'a1000004-0000-0000-0000-000000000001');

INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a1000005-0000-0000-0000-000000000001', '1.2.02', 'Intangível', 'ativo', 'devedora', true, false, true, 3, 220, 'a1000003-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('1.2.02.001', 'Software', 'ativo', 'devedora', false, true, true, 4, 221, 'a1000005-0000-0000-0000-000000000001'),
('1.2.02.002', '(-) Amortização Acumulada', 'ativo', 'devedora', false, true, true, 4, 222, 'a1000005-0000-0000-0000-000000000001');

-- GRUPO 2 - PASSIVO (novas)
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('2.1.01.003', 'Prestadores de Serviço a Pagar', 'passivo', 'credora', false, true, true, 4, 303, 'ad990570-3531-49c3-90f0-be061d5783b7'),
('2.1.01.004', 'Assistência 24h a Pagar', 'passivo', 'credora', false, true, true, 4, 304, 'ad990570-3531-49c3-90f0-be061d5783b7'),
('2.1.01.005', 'Outros Fornecedores a Pagar', 'passivo', 'credora', false, true, true, 4, 305, 'ad990570-3531-49c3-90f0-be061d5783b7');

INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('2.1.02.002', 'FGTS a Recolher', 'passivo', 'credora', false, true, true, 4, 312, '107f5032-b238-4cad-aaaf-975f0dcb715a'),
('2.1.02.003', 'INSS a Recolher', 'passivo', 'credora', false, true, true, 4, 313, '107f5032-b238-4cad-aaaf-975f0dcb715a'),
('2.1.02.004', 'IRRF a Recolher', 'passivo', 'credora', false, true, true, 4, 314, '107f5032-b238-4cad-aaaf-975f0dcb715a'),
('2.1.02.005', 'Férias e 13º Provisionados', 'passivo', 'credora', false, true, true, 4, 315, '107f5032-b238-4cad-aaaf-975f0dcb715a'),
('2.1.02.006', 'Comissões a Pagar', 'passivo', 'credora', false, true, true, 4, 316, '107f5032-b238-4cad-aaaf-975f0dcb715a');

INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('2.1.03.002', 'COFINS a Recolher', 'passivo', 'credora', false, true, true, 4, 322, 'bd0ae452-f3fe-471e-85fe-d8628dbbe14e'),
('2.1.03.003', 'ISS a Recolher', 'passivo', 'credora', false, true, true, 4, 323, 'bd0ae452-f3fe-471e-85fe-d8628dbbe14e'),
('2.1.03.004', 'IRPJ a Recolher', 'passivo', 'credora', false, true, true, 4, 324, 'bd0ae452-f3fe-471e-85fe-d8628dbbe14e'),
('2.1.03.005', 'CSLL a Recolher', 'passivo', 'credora', false, true, true, 4, 325, 'bd0ae452-f3fe-471e-85fe-d8628dbbe14e');

-- Provisões
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a2000001-0000-0000-0000-000000000001', '2.1.04', 'Provisões', 'passivo', 'credora', true, false, true, 3, 340, '2454d062-dcdc-4494-95d3-0aeb8788c4bf');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('2.1.04.001', 'Provisão para Sinistros', 'passivo', 'credora', false, true, true, 4, 341, 'a2000001-0000-0000-0000-000000000001'),
('2.1.04.002', 'Provisão para Indenizações', 'passivo', 'credora', false, true, true, 4, 342, 'a2000001-0000-0000-0000-000000000001'),
('2.1.04.003', 'Provisão para Contingências Judiciais', 'passivo', 'credora', false, true, true, 4, 343, 'a2000001-0000-0000-0000-000000000001');

-- Outras Obrigações
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a2000002-0000-0000-0000-000000000001', '2.1.05', 'Outras Obrigações', 'passivo', 'credora', true, false, true, 3, 350, '2454d062-dcdc-4494-95d3-0aeb8788c4bf');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('2.1.05.001', 'Contribuições Recebidas Antecipadamente', 'passivo', 'credora', false, true, true, 4, 351, 'a2000002-0000-0000-0000-000000000001'),
('2.1.05.002', 'Valores a Restituir a Associados', 'passivo', 'credora', false, true, true, 4, 352, 'a2000002-0000-0000-0000-000000000001');

-- Passivo Não Circulante
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a2000003-0000-0000-0000-000000000001', '2.2', 'PASSIVO NÃO CIRCULANTE', 'passivo', 'credora', true, false, true, 2, 400, 'de3ea180-8103-4cbe-912d-9999abc799a9');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a2000004-0000-0000-0000-000000000001', '2.2.01', 'Provisões de Longo Prazo', 'passivo', 'credora', true, false, true, 3, 410, 'a2000003-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('2.2.01.001', 'Provisão para Contingências LP', 'passivo', 'credora', false, true, true, 4, 411, 'a2000004-0000-0000-0000-000000000001');

-- GRUPO 3 - PATRIMÔNIO SOCIAL (novas)
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('3.2.02', 'Fundo de Reserva para Sinistros', 'patrimonio_liquido', 'credora', false, true, true, 3, 502, 'cc110d7f-ee34-475f-83e8-835e8b2030a5');
-- Make 3.3 sintética e add sub-contas
UPDATE plano_contas SET sintetica = true, aceita_lancamento = false WHERE id = '8cda4932-e2ab-4a6c-9451-a573123f957f';
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('3.3.01', 'Superávits Acumulados', 'patrimonio_liquido', 'credora', false, true, true, 3, 531, '8cda4932-e2ab-4a6c-9451-a573123f957f'),
('3.3.02', 'Déficits Acumulados', 'patrimonio_liquido', 'credora', false, true, true, 3, 532, '8cda4932-e2ab-4a6c-9451-a573123f957f');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('3.4', 'Superávit/Déficit do Exercício Corrente', 'patrimonio_liquido', 'credora', false, true, true, 2, 540, '96133076-b9ba-4f62-9005-64d044cb1622');

-- GRUPO 4 - RECEITAS (novas)
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('4.1.01.002', 'Contribuição Associativa ABP', 'receita', 'credora', false, true, true, 4, 602, '864e4cda-655e-4499-81a0-5a95427ca3c8'),
('4.1.01.003', 'Cotas de Coparticipação em Eventos', 'receita', 'credora', false, true, true, 4, 603, '864e4cda-655e-4499-81a0-5a95427ca3c8'),
('4.1.02.002', 'Taxas de Vistoria', 'receita', 'credora', false, true, true, 4, 612, 'fad5793c-4012-40e5-b88f-addc101127be'),
('4.1.02.003', 'Taxas de Troca de Titularidade', 'receita', 'credora', false, true, true, 4, 613, 'fad5793c-4012-40e5-b88f-addc101127be');

-- Outras Receitas Operacionais
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a4000001-0000-0000-0000-000000000001', '4.2', 'OUTRAS RECEITAS OPERACIONAIS', 'receita', 'credora', true, false, true, 2, 700, '786f6d0b-6862-47c0-a14f-48129e22cb4e');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a4000002-0000-0000-0000-000000000001', '4.2.01', 'Outras Receitas', 'receita', 'credora', true, false, true, 3, 710, 'a4000001-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('4.2.01.001', 'Receita com Venda de Salvados', 'receita', 'credora', false, true, true, 4, 711, 'a4000002-0000-0000-0000-000000000001'),
('4.2.01.002', 'Recuperação de Despesas', 'receita', 'credora', false, true, true, 4, 712, 'a4000002-0000-0000-0000-000000000001'),
('4.2.01.003', 'Receitas Eventuais', 'receita', 'credora', false, true, true, 4, 713, 'a4000002-0000-0000-0000-000000000001');

-- Receitas Financeiras
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a4000003-0000-0000-0000-000000000001', '4.3', 'RECEITAS FINANCEIRAS', 'receita', 'credora', true, false, true, 2, 800, '786f6d0b-6862-47c0-a14f-48129e22cb4e');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a4000004-0000-0000-0000-000000000001', '4.3.01', 'Receitas Financeiras', 'receita', 'credora', true, false, true, 3, 810, 'a4000003-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('4.3.01.001', 'Rendimentos de Aplicações Financeiras', 'receita', 'credora', false, true, true, 4, 811, 'a4000004-0000-0000-0000-000000000001'),
('4.3.01.002', 'Juros Recebidos', 'receita', 'credora', false, true, true, 4, 812, 'a4000004-0000-0000-0000-000000000001'),
('4.3.01.003', 'Descontos Obtidos', 'receita', 'credora', false, true, true, 4, 813, 'a4000004-0000-0000-0000-000000000001');

-- GRUPO 5 - DESPESAS (novas)
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.1.01.003', 'Serviços de Prestadores', 'despesa', 'devedora', false, true, true, 4, 903, 'cc5aafd7-0bf3-45c2-a5c8-1e150a53053a'),
('5.1.01.004', 'Pintura', 'despesa', 'devedora', false, true, true, 4, 904, 'cc5aafd7-0bf3-45c2-a5c8-1e150a53053a'),
('5.1.02.003', 'Carro Reserva', 'despesa', 'devedora', false, true, true, 4, 913, '641f2410-f2ff-4961-bde4-098fce27bcf6'),
('5.1.02.004', 'Outros Serviços de Assistência', 'despesa', 'devedora', false, true, true, 4, 914, '641f2410-f2ff-4961-bde4-098fce27bcf6'),
('5.1.03.003', 'Benefícios (VT, VR, plano de saúde)', 'despesa', 'devedora', false, true, true, 4, 923, 'c5cef9ec-879f-475d-b20d-4e356aa49326'),
('5.1.03.004', 'Férias e 13º', 'despesa', 'devedora', false, true, true, 4, 924, 'c5cef9ec-879f-475d-b20d-4e356aa49326'),
('5.1.03.005', 'Comissões de Consultores', 'despesa', 'devedora', false, true, true, 4, 925, 'c5cef9ec-879f-475d-b20d-4e356aa49326'),
('5.1.03.006', 'Comissões de Reguladores', 'despesa', 'devedora', false, true, true, 4, 926, 'c5cef9ec-879f-475d-b20d-4e356aa49326'),
('5.1.04.005', 'Limpeza e Conservação', 'despesa', 'devedora', false, true, true, 4, 945, '733ffcc8-bee2-4639-864d-1b19d9ec50ee');

-- Despesas com Tecnologia (5.2)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000001-0000-0000-0000-000000000001', '5.2', 'DESPESAS COM TECNOLOGIA', 'despesa', 'devedora', true, false, true, 2, 1000, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000002-0000-0000-0000-000000000001', '5.2.01', 'Tecnologia', 'despesa', 'devedora', true, false, true, 3, 1010, 'a5000001-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.2.01.001', 'Sistemas e Software', 'despesa', 'devedora', false, true, true, 4, 1011, 'a5000002-0000-0000-0000-000000000001'),
('5.2.01.002', 'Gateway de Pagamento (ASAAS)', 'despesa', 'devedora', false, true, true, 4, 1012, 'a5000002-0000-0000-0000-000000000001'),
('5.2.01.003', 'Hospedagem e Domínio', 'despesa', 'devedora', false, true, true, 4, 1013, 'a5000002-0000-0000-0000-000000000001'),
('5.2.01.004', 'Desenvolvimento de Software', 'despesa', 'devedora', false, true, true, 4, 1014, 'a5000002-0000-0000-0000-000000000001');

-- Despesas Jurídicas (5.3)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000003-0000-0000-0000-000000000001', '5.3', 'DESPESAS JURÍDICAS', 'despesa', 'devedora', true, false, true, 2, 1100, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000004-0000-0000-0000-000000000001', '5.3.01', 'Jurídicas', 'despesa', 'devedora', true, false, true, 3, 1110, 'a5000003-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.3.01.001', 'Honorários Advocatícios', 'despesa', 'devedora', false, true, true, 4, 1111, 'a5000004-0000-0000-0000-000000000001'),
('5.3.01.002', 'Custas Judiciais', 'despesa', 'devedora', false, true, true, 4, 1112, 'a5000004-0000-0000-0000-000000000001'),
('5.3.01.003', 'Despesas com Cartório e SPC/Serasa', 'despesa', 'devedora', false, true, true, 4, 1113, 'a5000004-0000-0000-0000-000000000001');

-- Despesas com Marketing (5.4)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000005-0000-0000-0000-000000000001', '5.4', 'DESPESAS COM MARKETING', 'despesa', 'devedora', true, false, true, 2, 1200, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000006-0000-0000-0000-000000000001', '5.4.01', 'Marketing', 'despesa', 'devedora', true, false, true, 3, 1210, 'a5000005-0000-0000-0000-000000000001');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.4.01.001', 'Publicidade e Propaganda', 'despesa', 'devedora', false, true, true, 4, 1211, 'a5000006-0000-0000-0000-000000000001'),
('5.4.01.002', 'Eventos e Patrocínios', 'despesa', 'devedora', false, true, true, 4, 1212, 'a5000006-0000-0000-0000-000000000001'),
('5.4.01.003', 'Materiais Impressos', 'despesa', 'devedora', false, true, true, 4, 1213, 'a5000006-0000-0000-0000-000000000001');

-- Despesas Tributárias (5.5)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000007-0000-0000-0000-000000000001', '5.5', 'DESPESAS TRIBUTÁRIAS', 'despesa', 'devedora', true, false, true, 2, 1300, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.5.01.001', 'PIS sobre Receita', 'despesa', 'devedora', false, true, true, 4, 1311, 'a5000007-0000-0000-0000-000000000001'),
('5.5.01.002', 'COFINS sobre Receita', 'despesa', 'devedora', false, true, true, 4, 1312, 'a5000007-0000-0000-0000-000000000001'),
('5.5.01.003', 'ISS', 'despesa', 'devedora', false, true, true, 4, 1313, 'a5000007-0000-0000-0000-000000000001'),
('5.5.01.004', 'IRPJ', 'despesa', 'devedora', false, true, true, 4, 1314, 'a5000007-0000-0000-0000-000000000001'),
('5.5.01.005', 'CSLL', 'despesa', 'devedora', false, true, true, 4, 1315, 'a5000007-0000-0000-0000-000000000001'),
('5.5.01.006', 'IPTU', 'despesa', 'devedora', false, true, true, 4, 1316, 'a5000007-0000-0000-0000-000000000001');

-- Depreciação e Amortização (5.6)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000008-0000-0000-0000-000000000001', '5.6', 'DEPRECIAÇÃO E AMORTIZAÇÃO', 'despesa', 'devedora', true, false, true, 2, 1400, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.6.01.001', 'Depreciação de Imobilizado', 'despesa', 'devedora', false, true, true, 4, 1411, 'a5000008-0000-0000-0000-000000000001'),
('5.6.01.002', 'Amortização de Intangível', 'despesa', 'devedora', false, true, true, 4, 1412, 'a5000008-0000-0000-0000-000000000001');

-- Provisões (5.7)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000009-0000-0000-0000-000000000001', '5.7', 'PROVISÕES', 'despesa', 'devedora', true, false, true, 2, 1500, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.7.01.001', 'Provisão para Devedores Duvidosos', 'despesa', 'devedora', false, true, true, 4, 1511, 'a5000009-0000-0000-0000-000000000001'),
('5.7.01.002', 'Provisão para Contingências', 'despesa', 'devedora', false, true, true, 4, 1512, 'a5000009-0000-0000-0000-000000000001');

-- Despesas com Sindicância e Perícia (5.8)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000010-0000-0000-0000-000000000001', '5.8', 'DESPESAS COM SINDICÂNCIA E PERÍCIA', 'despesa', 'devedora', true, false, true, 2, 1600, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.8.01.001', 'Empresas de Sindicância', 'despesa', 'devedora', false, true, true, 4, 1611, 'a5000010-0000-0000-0000-000000000001'),
('5.8.01.002', 'Perícia Técnica', 'despesa', 'devedora', false, true, true, 4, 1612, 'a5000010-0000-0000-0000-000000000001');

-- Despesas com Rastreamento (5.9)
INSERT INTO plano_contas (id, codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('a5000011-0000-0000-0000-000000000001', '5.9', 'DESPESAS COM RASTREAMENTO', 'despesa', 'devedora', true, false, true, 2, 1700, 'a0b743a3-aa2c-436a-9b03-908b8b58bc12');
INSERT INTO plano_contas (codigo, descricao, tipo, natureza, sintetica, aceita_lancamento, ativa, nivel, ordem, conta_pai_id) VALUES
('5.9.01.001', 'Mensalidade de Rastreadores', 'despesa', 'devedora', false, true, true, 4, 1711, 'a5000011-0000-0000-0000-000000000001'),
('5.9.01.002', 'Instalação de Rastreadores', 'despesa', 'devedora', false, true, true, 4, 1712, 'a5000011-0000-0000-0000-000000000001'),
('5.9.01.003', 'Manutenção de Rastreadores', 'despesa', 'devedora', false, true, true, 4, 1713, 'a5000011-0000-0000-0000-000000000001');
