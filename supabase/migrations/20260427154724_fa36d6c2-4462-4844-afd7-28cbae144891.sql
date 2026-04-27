INSERT INTO public.agente_ia_config (chave, valor)
VALUES ('agente_ativo', 'true')
ON CONFLICT (chave) DO NOTHING;