INSERT INTO public.configuracoes (chave, valor, categoria, tipo, descricao)
VALUES ('fipe_menor_limite_minimo', '30000', 'operacional', 'moeda',
        'Valor FIPE mínimo (geral) abaixo do qual a Regra do 1% / Redução de Cota não aparece')
ON CONFLICT (chave) DO NOTHING;