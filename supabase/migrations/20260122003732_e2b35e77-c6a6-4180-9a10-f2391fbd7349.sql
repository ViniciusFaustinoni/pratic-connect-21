-- Adicionar coluna para armazenar o IMEI informado pelo instalador
-- O rastreador será vinculado pelo analista cadastral posteriormente
ALTER TABLE public.instalacoes 
ADD COLUMN IF NOT EXISTS imei_rastreador TEXT;

COMMENT ON COLUMN public.instalacoes.imei_rastreador IS 
  'IMEI informado pelo instalador. Será validado e vinculado ao veículo pelo analista cadastral.';

-- Criar índice para busca por IMEI
CREATE INDEX IF NOT EXISTS idx_instalacoes_imei_rastreador ON public.instalacoes(imei_rastreador) WHERE imei_rastreador IS NOT NULL;

-- Permitir que prestadores visualizem rastreadores em estoque para validação do IMEI
CREATE POLICY "Prestadores podem visualizar rastreadores em estoque"
ON public.rastreadores FOR SELECT
USING (
  (is_prestador(auth.uid()) AND status = 'estoque')
  OR is_funcionario(auth.uid())
);