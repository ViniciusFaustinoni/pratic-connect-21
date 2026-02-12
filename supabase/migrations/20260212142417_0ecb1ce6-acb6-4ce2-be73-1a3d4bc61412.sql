
-- Criar tabela termos_aditivos
CREATE TABLE public.termos_aditivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR NOT NULL,
  descricao TEXT,
  conteudo_html TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  regras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.termos_aditivos ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users
CREATE POLICY "Authenticated users can view termos_aditivos"
ON public.termos_aditivos FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: diretor/admin only
CREATE POLICY "Directors and admins can insert termos_aditivos"
ON public.termos_aditivos FOR INSERT
WITH CHECK (public.is_diretor_or_admin(auth.uid()));

-- UPDATE: diretor/admin only
CREATE POLICY "Directors and admins can update termos_aditivos"
ON public.termos_aditivos FOR UPDATE
USING (public.is_diretor_or_admin(auth.uid()));

-- DELETE: diretor/admin only
CREATE POLICY "Directors and admins can delete termos_aditivos"
ON public.termos_aditivos FOR DELETE
USING (public.is_diretor_or_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_termos_aditivos_updated_at
BEFORE UPDATE ON public.termos_aditivos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração do limite FIPE
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('aditivo_fipe_limite', '100000', 'moeda', 'operacional', 'Valor FIPE a partir do qual aditivos com regra "fipe_acima_de" são anexados automaticamente', true)
ON CONFLICT (chave) DO NOTHING;
