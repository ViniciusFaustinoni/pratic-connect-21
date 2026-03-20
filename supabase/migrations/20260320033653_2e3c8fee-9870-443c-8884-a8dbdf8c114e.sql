INSERT INTO public.configuracoes (chave, valor, descricao, tipo, categoria)
VALUES ('limite_veiculos_associado', '0', 'Limite máximo de veículos por associado. Quando 0 ou vazio, não aplica limite.', 'numero', 'regras_venda')
ON CONFLICT (chave) DO NOTHING;