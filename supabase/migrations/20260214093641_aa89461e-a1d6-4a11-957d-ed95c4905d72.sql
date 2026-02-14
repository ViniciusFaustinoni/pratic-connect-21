
-- =============================================
-- Tabela: sinistro_evento_links
-- Links únicos expiráveis para etapas pós-sinistro
-- =============================================
CREATE TABLE public.sinistro_evento_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id UUID NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'colisao_etapas',
  status TEXT NOT NULL DEFAULT 'ativo',
  etapa_atual INTEGER NOT NULL DEFAULT 0,
  etapa1_completada_em TIMESTAMPTZ,
  etapa2_completada_em TIMESTAMPTZ,
  etapa3_completada_em TIMESTAMPTZ,
  dados_etapa1 JSONB,
  dados_etapa2 JSONB,
  dados_etapa3 JSONB,
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Índices
CREATE INDEX idx_sinistro_evento_links_sinistro ON public.sinistro_evento_links(sinistro_id);
CREATE INDEX idx_sinistro_evento_links_token ON public.sinistro_evento_links(token);
CREATE INDEX idx_sinistro_evento_links_status ON public.sinistro_evento_links(status);

-- RLS
ALTER TABLE public.sinistro_evento_links ENABLE ROW LEVEL SECURITY;

-- Anon: SELECT/UPDATE filtrado por token válido
CREATE POLICY "anon_select_by_token"
ON public.sinistro_evento_links
FOR SELECT
TO anon
USING (true);

CREATE POLICY "anon_update_by_token"
ON public.sinistro_evento_links
FOR UPDATE
TO anon
USING (status = 'ativo' AND expira_em > now())
WITH CHECK (status = 'ativo' AND expira_em > now());

-- Authenticated: acesso total
CREATE POLICY "auth_full_access"
ON public.sinistro_evento_links
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================
-- Tabela: sinistro_contatos_agendados
-- Registro de contatos automáticos agendados
-- =============================================
CREATE TABLE public.sinistro_contatos_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id UUID NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  tipo_contato TEXT NOT NULL DEFAULT 'whatsapp_pos_colisao',
  agendado_para TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado',
  link_id UUID REFERENCES public.sinistro_evento_links(id),
  mensagem_enviada TEXT,
  erro_detalhes TEXT,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sinistro_contatos_status ON public.sinistro_contatos_agendados(status, agendado_para);
CREATE INDEX idx_sinistro_contatos_sinistro ON public.sinistro_contatos_agendados(sinistro_id);

ALTER TABLE public.sinistro_contatos_agendados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_full_access_contatos"
ON public.sinistro_contatos_agendados
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================
-- Coluna link_evento_id na tabela sinistros
-- =============================================
ALTER TABLE public.sinistros
ADD COLUMN link_evento_id UUID REFERENCES public.sinistro_evento_links(id);
