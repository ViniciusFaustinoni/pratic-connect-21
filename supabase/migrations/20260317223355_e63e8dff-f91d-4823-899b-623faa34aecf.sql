INSERT INTO public.configuracoes (chave, valor, descricao, tipo, categoria)
VALUES ('fipe_limite_autorizacao_moto', '30000', 'Limite FIPE para autorização automática - Motos', 'moeda', 'atuarial')
ON CONFLICT (chave) DO NOTHING;