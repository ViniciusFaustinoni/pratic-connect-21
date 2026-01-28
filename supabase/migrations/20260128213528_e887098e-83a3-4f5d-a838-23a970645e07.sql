-- Adiciona status 'em_sindicancia' ao enum de status de sinistro (se existir como enum)
-- Como o campo status em sinistros é TEXT, apenas precisamos adicionar o campo de rastreabilidade

-- Adiciona campo para rastrear origem do sinistro quando vem de um chamado de assistência
ALTER TABLE public.sinistros
ADD COLUMN IF NOT EXISTS chamado_origem_id UUID REFERENCES public.chamados_assistencia(id) ON DELETE SET NULL;

-- Criar índice para busca por chamado de origem
CREATE INDEX IF NOT EXISTS idx_sinistros_chamado_origem 
ON public.sinistros(chamado_origem_id) 
WHERE chamado_origem_id IS NOT NULL;

-- Adicionar comentário documentando a coluna
COMMENT ON COLUMN public.sinistros.chamado_origem_id IS 'ID do chamado de assistência que originou este sinistro, se aplicável';