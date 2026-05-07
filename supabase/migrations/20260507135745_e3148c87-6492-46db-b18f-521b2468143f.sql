INSERT INTO public.configuracoes (chave, valor, categoria, tipo, descricao)
VALUES ('fipe_menor_limite_minimo_moto', '9000', 'operacional', 'moeda',
        'Valor FIPE mínimo para Motos abaixo do qual a Regra do 1% / Redução de Cota não aparece')
ON CONFLICT (chave) DO NOTHING;

-- Renomeia a chave existente para deixar explícito que é o mínimo de carros
INSERT INTO public.configuracoes (chave, valor, categoria, tipo, descricao)
VALUES ('fipe_menor_limite_minimo_carro', '30000', 'operacional', 'moeda',
        'Valor FIPE mínimo para Carros abaixo do qual a Regra do 1% / Redução de Cota não aparece')
ON CONFLICT (chave) DO NOTHING;