-- Criar tabela para planos de interesse do lead (etapa NOVO)
CREATE TABLE IF NOT EXISTS public.leads_interesse_planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, plano_id)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_leads_interesse_planos_lead ON public.leads_interesse_planos(lead_id);

-- Adicionar campos de proposta na tabela leads (se não existirem)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS plano_escolhido_id UUID REFERENCES public.planos(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS plano_escolhido_nome VARCHAR(100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS plano_escolhido_valor DECIMAL(12,2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cotacao_id UUID REFERENCES public.cotacoes(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proposta_enviada_em TIMESTAMPTZ;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proposta_assinada_em TIMESTAMPTZ;

-- Habilitar RLS
ALTER TABLE public.leads_interesse_planos ENABLE ROW LEVEL SECURITY;

-- Política: mesma lógica de leads - vendedor vê seus leads, gerência vê todos
CREATE POLICY "Users can view interesse planos of accessible leads"
ON public.leads_interesse_planos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
    AND (l.vendedor_id = auth.uid() OR is_gerencia(auth.uid()))
  )
);

CREATE POLICY "Users can insert interesse planos for accessible leads"
ON public.leads_interesse_planos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
    AND (l.vendedor_id = auth.uid() OR is_gerencia(auth.uid()))
  )
);

CREATE POLICY "Users can delete interesse planos of accessible leads"
ON public.leads_interesse_planos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id
    AND (l.vendedor_id = auth.uid() OR is_gerencia(auth.uid()))
  )
);