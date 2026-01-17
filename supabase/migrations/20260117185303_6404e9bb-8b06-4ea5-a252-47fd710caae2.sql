-- Tabela para fotos de autovistoria das cotações (caso não exista ainda)
CREATE TABLE IF NOT EXISTS public.cotacoes_vistoria_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL,
  arquivo_url TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cotacao_id, tipo)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_cotacoes_vistoria_fotos_cotacao ON public.cotacoes_vistoria_fotos(cotacao_id);

-- Enable RLS
ALTER TABLE public.cotacoes_vistoria_fotos ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir acesso anon total (para o link público funcionar)
CREATE POLICY "Acesso público para cotações com token"
ON public.cotacoes_vistoria_fotos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacoes_vistoria_fotos.cotacao_id
    AND c.token_publico IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cotacoes c
    WHERE c.id = cotacoes_vistoria_fotos.cotacao_id
    AND c.token_publico IS NOT NULL
  )
);

-- Policy: Usuários autenticados têm acesso total
CREATE POLICY "Usuários autenticados acesso total"
ON public.cotacoes_vistoria_fotos
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');