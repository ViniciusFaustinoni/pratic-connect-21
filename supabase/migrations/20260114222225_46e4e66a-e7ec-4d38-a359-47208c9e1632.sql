-- Criar lead para a cliente RAYANE (dados do contrato)
INSERT INTO leads (
  nome, telefone, email, cpf,
  veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, veiculo_fipe,
  origem, etapa, associado_id
) VALUES (
  'RAYANE DA FONSECA VELHO PIMENTEL',
  '(21) 99393-7099',
  'rayane.piimentel@gmail.com',
  '173.133.397-80',
  'VW', 'GOL TL MB S', 2014, 'LRM2934', 35848.00,
  'cotador', 'ganho', 'ed07a7a5-58f1-4cd6-9ce6-16babae9e572'
);

-- Vincular cotação ao lead recém-criado
UPDATE cotacoes 
SET lead_id = (SELECT id FROM leads WHERE cpf = '173.133.397-80' LIMIT 1)
WHERE id = '2cedc674-c7e7-42b6-a74e-b1c19aaa59dc';

-- Vincular contrato ao lead recém-criado
UPDATE contratos 
SET lead_id = (SELECT id FROM leads WHERE cpf = '173.133.397-80' LIMIT 1)
WHERE id = 'c28c2718-d9aa-4c43-a7f2-b986671abc3f';