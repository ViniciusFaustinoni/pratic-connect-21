-- Tabela: Associações Concorrentes Cadastradas
CREATE TABLE public.associacoes_concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  palavras_chave TEXT[],
  dominios_email TEXT[],
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela: Registro de Indícios de Concorrência
CREATE TABLE public.auditoria_indicios_concorrencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES public.profiles(id) NOT NULL,
  tipo_indicio VARCHAR(50) NOT NULL,
  descricao TEXT,
  associacao_concorrente_id UUID REFERENCES public.associacoes_concorrentes(id),
  dados_evidencia JSONB,
  score_risco INTEGER DEFAULT 20,
  status VARCHAR(20) DEFAULT 'pendente',
  analisado_por UUID REFERENCES public.profiles(id),
  analisado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_indicios_vendedor ON public.auditoria_indicios_concorrencia(vendedor_id);
CREATE INDEX idx_indicios_status ON public.auditoria_indicios_concorrencia(status);
CREATE INDEX idx_indicios_created ON public.auditoria_indicios_concorrencia(created_at DESC);
CREATE INDEX idx_concorrentes_ativo ON public.associacoes_concorrentes(ativo) WHERE ativo = true;

-- View: Métricas de Conflito por Vendedor
CREATE OR REPLACE VIEW public.vw_vendedores_conflito AS
SELECT 
  p.id as vendedor_id,
  p.nome,
  p.email,
  COUNT(DISTINCT aic.id) as total_indicios,
  COUNT(DISTINCT CASE WHEN aic.status = 'confirmado' THEN aic.id END) as indicios_confirmados,
  COUNT(DISTINCT CASE WHEN aic.status = 'pendente' THEN aic.id END) as indicios_pendentes,
  MAX(aic.created_at) as ultimo_indicio,
  SUM(aic.score_risco) as score_total,
  ARRAY_AGG(DISTINCT ac.nome) FILTER (WHERE ac.nome IS NOT NULL) as associacoes_envolvidas
FROM public.profiles p
INNER JOIN public.auditoria_indicios_concorrencia aic ON aic.vendedor_id = p.id
LEFT JOIN public.associacoes_concorrentes ac ON ac.id = aic.associacao_concorrente_id
GROUP BY p.id, p.nome, p.email;

-- Enable RLS
ALTER TABLE public.associacoes_concorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_indicios_concorrencia ENABLE ROW LEVEL SECURITY;

-- RLS Policies para associacoes_concorrentes (apenas gestores podem gerenciar)
CREATE POLICY "Gestores podem visualizar concorrentes"
ON public.associacoes_concorrentes FOR SELECT
TO authenticated
USING (
  public.is_gerencia(auth.uid()) OR 
  public.is_diretor(auth.uid()) OR 
  public.is_desenvolvedor(auth.uid()) OR
  public.is_admin_master(auth.uid())
);

CREATE POLICY "Gestores podem inserir concorrentes"
ON public.associacoes_concorrentes FOR INSERT
TO authenticated
WITH CHECK (
  public.is_gerencia(auth.uid()) OR 
  public.is_diretor(auth.uid()) OR 
  public.is_desenvolvedor(auth.uid()) OR
  public.is_admin_master(auth.uid())
);

CREATE POLICY "Gestores podem atualizar concorrentes"
ON public.associacoes_concorrentes FOR UPDATE
TO authenticated
USING (
  public.is_gerencia(auth.uid()) OR 
  public.is_diretor(auth.uid()) OR 
  public.is_desenvolvedor(auth.uid()) OR
  public.is_admin_master(auth.uid())
);

CREATE POLICY "Gestores podem deletar concorrentes"
ON public.associacoes_concorrentes FOR DELETE
TO authenticated
USING (
  public.is_diretor(auth.uid()) OR 
  public.is_desenvolvedor(auth.uid()) OR
  public.is_admin_master(auth.uid())
);

-- RLS Policies para auditoria_indicios_concorrencia
CREATE POLICY "Gestores podem visualizar indicios"
ON public.auditoria_indicios_concorrencia FOR SELECT
TO authenticated
USING (
  public.is_gerencia(auth.uid()) OR 
  public.is_diretor(auth.uid()) OR 
  public.is_desenvolvedor(auth.uid()) OR
  public.is_admin_master(auth.uid())
);

CREATE POLICY "Sistema pode inserir indicios"
ON public.auditoria_indicios_concorrencia FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Gestores podem atualizar indicios"
ON public.auditoria_indicios_concorrencia FOR UPDATE
TO authenticated
USING (
  public.is_gerencia(auth.uid()) OR 
  public.is_diretor(auth.uid()) OR 
  public.is_desenvolvedor(auth.uid()) OR
  public.is_admin_master(auth.uid())
);

-- Trigger para updated_at em associacoes_concorrentes
CREATE OR REPLACE FUNCTION public.update_associacoes_concorrentes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_associacoes_concorrentes_updated_at
BEFORE UPDATE ON public.associacoes_concorrentes
FOR EACH ROW
EXECUTE FUNCTION public.update_associacoes_concorrentes_updated_at();