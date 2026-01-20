-- 1. Adicionar coluna cotacao_token_publico em contratos
ALTER TABLE public.contratos 
ADD COLUMN IF NOT EXISTS cotacao_token_publico text;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_contratos_cotacao_token_publico 
ON public.contratos(cotacao_token_publico) 
WHERE cotacao_token_publico IS NOT NULL;

-- 3. Backfill: popular contratos existentes com o token_publico da cotação vinculada
UPDATE public.contratos c
SET cotacao_token_publico = cot.token_publico
FROM public.cotacoes cot
WHERE cot.id = c.cotacao_id
  AND cot.token_publico IS NOT NULL
  AND c.cotacao_token_publico IS NULL;

-- 4. Criar policy RLS para anon acessar contratos via cotacao_token_publico
CREATE POLICY "anon_select_contratos_by_cotacao_token" 
ON public.contratos 
FOR SELECT 
TO anon
USING (cotacao_token_publico IS NOT NULL);

-- 5. Policy para anon acessar associados vinculados a contratos públicos
CREATE POLICY "anon_select_associados_via_contrato_publico" 
ON public.associados 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.contratos c 
    WHERE c.associado_id = associados.id 
    AND c.cotacao_token_publico IS NOT NULL
  )
);