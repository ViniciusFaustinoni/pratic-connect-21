
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES 
  ('fipe_menor_limite_carro', '120000', 'moeda', 'operacional', 'Limite máximo do valor FIPE para carros elegíveis à Regra do 1% (FIPE Menor). Veículos acima desse valor não podem solicitar a redução.', true),
  ('fipe_menor_limite_moto', '27000', 'moeda', 'operacional', 'Limite máximo do valor FIPE para motos elegíveis à Regra do 1% (FIPE Menor). Veículos acima desse valor não podem solicitar a redução.', true)
ON CONFLICT (chave) DO NOTHING;
