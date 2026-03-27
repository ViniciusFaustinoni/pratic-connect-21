-- Delete all plan-related data and plans
DELETE FROM entity_eligibility_rules WHERE entity_type IN ('plano', 'cobertura', 'beneficio');
DELETE FROM planos_coberturas;
DELETE FROM planos_beneficios;
DELETE FROM planos_regioes;
DELETE FROM tabelas_preco_mensalidade;
DELETE FROM planos;
