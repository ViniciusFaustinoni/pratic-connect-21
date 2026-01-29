-- ============================================
-- MIGRAÇÃO: MÓDULO MARKETING - NOVAS TABELAS
-- ============================================

-- 1. Tabela: campanhas_comunicacao (Disparos em massa)
CREATE TABLE IF NOT EXISTS public.campanhas_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('email', 'whatsapp', 'sms')),
  assunto VARCHAR(500),
  conteudo TEXT,
  template_id UUID,
  segmento VARCHAR(100),
  filtros JSONB,
  total_destinatarios INTEGER DEFAULT 0,
  enviados INTEGER DEFAULT 0,
  entregues INTEGER DEFAULT 0,
  abertos INTEGER DEFAULT 0,
  clicados INTEGER DEFAULT 0,
  falhas INTEGER DEFAULT 0,
  data_agendamento TIMESTAMP WITH TIME ZONE,
  iniciado_em TIMESTAMP WITH TIME ZONE,
  concluido_em TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'agendada', 'enviando', 'pausada', 'concluida', 'cancelada')),
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela: disparos_comunicacao (Registros individuais de disparo)
CREATE TABLE IF NOT EXISTS public.disparos_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID REFERENCES public.campanhas_comunicacao(id) ON DELETE CASCADE,
  contato_id UUID,
  contato_tipo VARCHAR(20) CHECK (contato_tipo IN ('associado', 'lead', 'outro')),
  nome VARCHAR(255),
  telefone VARCHAR(20),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'entregue', 'falha', 'aberto', 'clicado', 'bounce', 'descadastro')),
  erro_codigo VARCHAR(50),
  erro_mensagem TEXT,
  tentativas INTEGER DEFAULT 0,
  enviado_em TIMESTAMP WITH TIME ZONE,
  entregue_em TIMESTAMP WITH TIME ZONE,
  aberto_em TIMESTAMP WITH TIME ZONE,
  clicado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela: redes_sociais_contas (Contas conectadas)
CREATE TABLE IF NOT EXISTS public.redes_sociais_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma VARCHAR(50) NOT NULL CHECK (plataforma IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'twitter')),
  nome_conta VARCHAR(255),
  username VARCHAR(100),
  pagina_id VARCHAR(100),
  access_token TEXT,
  refresh_token TEXT,
  token_expira_em TIMESTAMP WITH TIME ZONE,
  seguidores INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'conectado' CHECK (status IN ('conectado', 'desconectado', 'expirado', 'erro')),
  ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela: redes_sociais_metricas (Métricas diárias)
CREATE TABLE IF NOT EXISTS public.redes_sociais_metricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID REFERENCES public.redes_sociais_contas(id) ON DELETE CASCADE,
  periodo DATE NOT NULL,
  alcance INTEGER DEFAULT 0,
  impressoes INTEGER DEFAULT 0,
  engajamento INTEGER DEFAULT 0,
  novos_seguidores INTEGER DEFAULT 0,
  publicacoes INTEGER DEFAULT 0,
  curtidas INTEGER DEFAULT 0,
  comentarios INTEGER DEFAULT 0,
  compartilhamentos INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conta_id, periodo)
);

-- 5. Adicionar novos campos à tabela campanhas (objetivo, tipo_anuncio, segmentacao)
ALTER TABLE public.campanhas 
  ADD COLUMN IF NOT EXISTS objetivo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tipo_anuncio VARCHAR(50),
  ADD COLUMN IF NOT EXISTS segmentacao TEXT;

-- 6. Adicionar campo utm_source padrão aos canais
ALTER TABLE public.canais_marketing 
  ADD COLUMN IF NOT EXISTS utm_source_padrao VARCHAR(100);

-- 7. Adicionar campo link_personalizado às indicações (para código único do associado)
ALTER TABLE public.indicacoes
  ADD COLUMN IF NOT EXISTS link_referencia VARCHAR(255);

-- 8. Criar função para gerar código de campanha de comunicação
CREATE OR REPLACE FUNCTION public.gerar_codigo_campanha_comunicacao()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  prefixo VARCHAR(10);
BEGIN
  prefixo := CASE NEW.tipo
    WHEN 'email' THEN 'EML'
    WHEN 'whatsapp' THEN 'WPP'
    WHEN 'sms' THEN 'SMS'
    ELSE 'COM'
  END;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5 FOR 5) AS INTEGER)), 0) + 1
  INTO seq
  FROM public.campanhas_comunicacao
  WHERE codigo LIKE prefixo || '-%';
  
  NEW.codigo := prefixo || '-' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 9. Criar trigger para gerar código automaticamente
DROP TRIGGER IF EXISTS trigger_gerar_codigo_campanha_comunicacao ON public.campanhas_comunicacao;
CREATE TRIGGER trigger_gerar_codigo_campanha_comunicacao
  BEFORE INSERT ON public.campanhas_comunicacao
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION public.gerar_codigo_campanha_comunicacao();

-- 10. Habilitar RLS nas novas tabelas
ALTER TABLE public.campanhas_comunicacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparos_comunicacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redes_sociais_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redes_sociais_metricas ENABLE ROW LEVEL SECURITY;

-- 11. Policies para campanhas_comunicacao
CREATE POLICY "campanhas_comunicacao_select_policy" ON public.campanhas_comunicacao
  FOR SELECT TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "campanhas_comunicacao_insert_policy" ON public.campanhas_comunicacao
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "campanhas_comunicacao_update_policy" ON public.campanhas_comunicacao
  FOR UPDATE TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "campanhas_comunicacao_delete_policy" ON public.campanhas_comunicacao
  FOR DELETE TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

-- 12. Policies para disparos_comunicacao
CREATE POLICY "disparos_comunicacao_select_policy" ON public.disparos_comunicacao
  FOR SELECT TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "disparos_comunicacao_insert_policy" ON public.disparos_comunicacao
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "disparos_comunicacao_update_policy" ON public.disparos_comunicacao
  FOR UPDATE TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

-- 13. Policies para redes_sociais_contas
CREATE POLICY "redes_sociais_contas_select_policy" ON public.redes_sociais_contas
  FOR SELECT TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "redes_sociais_contas_insert_policy" ON public.redes_sociais_contas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "redes_sociais_contas_update_policy" ON public.redes_sociais_contas
  FOR UPDATE TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "redes_sociais_contas_delete_policy" ON public.redes_sociais_contas
  FOR DELETE TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

-- 14. Policies para redes_sociais_metricas
CREATE POLICY "redes_sociais_metricas_select_policy" ON public.redes_sociais_metricas
  FOR SELECT TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "redes_sociais_metricas_insert_policy" ON public.redes_sociais_metricas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

CREATE POLICY "redes_sociais_metricas_update_policy" ON public.redes_sociais_metricas
  FOR UPDATE TO authenticated
  USING (public.can_manage_marketing(auth.uid()) OR public.is_gerencia(auth.uid()));

-- 15. Índices para performance
CREATE INDEX IF NOT EXISTS idx_campanhas_comunicacao_tipo ON public.campanhas_comunicacao(tipo);
CREATE INDEX IF NOT EXISTS idx_campanhas_comunicacao_status ON public.campanhas_comunicacao(status);
CREATE INDEX IF NOT EXISTS idx_disparos_comunicacao_campanha_id ON public.disparos_comunicacao(campanha_id);
CREATE INDEX IF NOT EXISTS idx_disparos_comunicacao_status ON public.disparos_comunicacao(status);
CREATE INDEX IF NOT EXISTS idx_redes_sociais_metricas_conta_periodo ON public.redes_sociais_metricas(conta_id, periodo);
CREATE INDEX IF NOT EXISTS idx_campanhas_objetivo ON public.campanhas(objetivo);
CREATE INDEX IF NOT EXISTS idx_campanhas_tipo_anuncio ON public.campanhas(tipo_anuncio);