-- Add solicitacao_id column to servicos table
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS solicitacao_id UUID REFERENCES public.chat_solicitacoes_ia(id);

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_servicos_solicitacao_id ON public.servicos(solicitacao_id) WHERE solicitacao_id IS NOT NULL;

-- Insert config for cenario A grace period (0 = dispensed)
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('carencia_troca_titularidade_cenario_a', '0', 'numero', 'operacional', 'Dias de carência para troca de titularidade no Cenário A (0 = dispensada)')
ON CONFLICT (chave) DO NOTHING;