-- Inserir 3 Planos de Exemplo
INSERT INTO planos (codigo, nome, tipo_uso, tipo_veiculo, valor_adesao, descricao, ativo, destaque, ordem) VALUES
('BASICO', 'Proteção Básica', 'passeio', 'carro', 199.90, 
 'Plano básico de proteção veicular com cobertura essencial para uso particular', true, false, 1),
('TOTAL', 'Proteção Total', 'passeio', 'carro', 299.90, 
 'Proteção completa com assistência 24h incluída e cobertura ampliada', true, true, 2),
('PREMIUM', 'Proteção Premium', 'trabalho', 'carro', 399.90, 
 'Proteção premium com benefícios exclusivos, atendimento VIP e cobertura para uso profissional', true, false, 3);

-- Inserir Tabelas de Preço para Plano BÁSICO
INSERT INTO tabelas_preco (plano_id, fipe_de, fipe_ate, valor_cota, taxa_administrativa, valor_rastreamento, valor_assistencia, ativo, vigencia_inicio)
SELECT p.id, 0, 50000, 125.00, 49.90, 39.90, 0, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'BASICO'
UNION ALL
SELECT p.id, 50001, 100000, 250.00, 49.90, 39.90, 0, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'BASICO'
UNION ALL
SELECT p.id, 100001, 200000, 500.00, 49.90, 39.90, 0, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'BASICO'
UNION ALL
SELECT p.id, 200001, 500000, 1000.00, 49.90, 39.90, 0, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'BASICO';

-- Inserir Tabelas de Preço para Plano TOTAL
INSERT INTO tabelas_preco (plano_id, fipe_de, fipe_ate, valor_cota, taxa_administrativa, valor_rastreamento, valor_assistencia, ativo, vigencia_inicio)
SELECT p.id, 0, 50000, 150.00, 59.90, 39.90, 29.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'TOTAL'
UNION ALL
SELECT p.id, 50001, 100000, 300.00, 59.90, 39.90, 29.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'TOTAL'
UNION ALL
SELECT p.id, 100001, 200000, 600.00, 59.90, 39.90, 29.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'TOTAL'
UNION ALL
SELECT p.id, 200001, 500000, 1200.00, 59.90, 39.90, 29.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'TOTAL';

-- Inserir Tabelas de Preço para Plano PREMIUM
INSERT INTO tabelas_preco (plano_id, fipe_de, fipe_ate, valor_cota, taxa_administrativa, valor_rastreamento, valor_assistencia, ativo, vigencia_inicio)
SELECT p.id, 0, 50000, 175.00, 69.90, 49.90, 49.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'PREMIUM'
UNION ALL
SELECT p.id, 50001, 100000, 350.00, 69.90, 49.90, 49.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'PREMIUM'
UNION ALL
SELECT p.id, 100001, 200000, 700.00, 69.90, 49.90, 49.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'PREMIUM'
UNION ALL
SELECT p.id, 200001, 500000, 1400.00, 69.90, 49.90, 49.90, true, CURRENT_DATE FROM planos p WHERE p.codigo = 'PREMIUM';