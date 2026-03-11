DO $$
BEGIN
  UPDATE product_lines SET blocked_categories = ARRAY['leilao','chassi_remarcado','ressarcimento_integral','taxi','ex_taxi','placa_vermelha']
  WHERE slug IN ('select', 'select-one', 'lancamento');
END $$;