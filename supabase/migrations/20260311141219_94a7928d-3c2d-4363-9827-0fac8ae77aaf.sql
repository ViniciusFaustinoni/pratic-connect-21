INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('atuarial_valor_cota_participacao', '200', 'numero', 'atuarial', 'Valor monetário por cota de participação em sinistro (R$)')
ON CONFLICT (chave) DO NOTHING;