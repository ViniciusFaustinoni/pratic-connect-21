
-- Add blindado column to veiculos table
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS blindado boolean DEFAULT false;

-- Insert aceitar_blindado config key
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('aceitar_blindado', 'autorizar', 'texto', 'atuarial', 'Política para veículos blindados: autorizar (requer aprovação diretoria) ou bloquear (proibido)')
ON CONFLICT (chave) DO NOTHING;
