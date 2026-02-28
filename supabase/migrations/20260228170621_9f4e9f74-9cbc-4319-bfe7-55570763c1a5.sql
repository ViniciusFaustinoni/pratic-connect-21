
-- 1. Criar tabela de alocações diárias
CREATE TABLE public.alocacoes_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo_alocacao text NOT NULL CHECK (tipo_alocacao IN ('rota', 'base')),
  definido_por uuid REFERENCES public.profiles(id),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profissional_id, data)
);

-- RLS
ALTER TABLE public.alocacoes_diarias ENABLE ROW LEVEL SECURITY;

-- Leitura para todos autenticados
CREATE POLICY "Authenticated users can read alocacoes"
  ON public.alocacoes_diarias FOR SELECT
  TO authenticated
  USING (true);

-- Escrita para coordenadores e diretores
CREATE POLICY "Coordenadores e diretores can manage alocacoes"
  ON public.alocacoes_diarias FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenador_monitoramento') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenador_monitoramento') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  );

-- 2. Migrar vistoriador_base para instalador_vistoriador
-- Adicionar role instalador_vistoriador para quem só tem vistoriador_base
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'instalador_vistoriador'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'vistoriador_base'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'instalador_vistoriador'
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Remover role vistoriador_base
DELETE FROM public.user_roles WHERE role = 'vistoriador_base';

-- 3. Índices
CREATE INDEX idx_alocacoes_diarias_data ON public.alocacoes_diarias(data);
CREATE INDEX idx_alocacoes_diarias_profissional ON public.alocacoes_diarias(profissional_id, data);
