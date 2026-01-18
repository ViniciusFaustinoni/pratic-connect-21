-- Tabela para registrar alertas de auditoria de vendedores
CREATE TABLE public.auditoria_vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo_alerta VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  dados JSONB,
  score_risco INTEGER DEFAULT 0 CHECK (score_risco >= 0 AND score_risco <= 100),
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'analisado', 'ignorado', 'confirmado')),
  analisado_por UUID REFERENCES profiles(id),
  analisado_em TIMESTAMPTZ,
  observacoes_analise TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para status de monitoramento de vendedores
CREATE TABLE public.vendedores_monitoramento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  status_monitoramento VARCHAR(30) DEFAULT 'normal' CHECK (status_monitoramento IN ('normal', 'sob_observacao', 'suspenso')),
  motivo TEXT,
  score_risco_acumulado INTEGER DEFAULT 0,
  total_alertas INTEGER DEFAULT 0,
  alertas_confirmados INTEGER DEFAULT 0,
  ultima_analise TIMESTAMPTZ,
  analisado_por UUID REFERENCES profiles(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_auditoria_vendedores_vendedor ON auditoria_vendedores(vendedor_id);
CREATE INDEX idx_auditoria_vendedores_status ON auditoria_vendedores(status);
CREATE INDEX idx_auditoria_vendedores_tipo ON auditoria_vendedores(tipo_alerta);
CREATE INDEX idx_auditoria_vendedores_created ON auditoria_vendedores(created_at DESC);
CREATE INDEX idx_vendedores_monitoramento_status ON vendedores_monitoramento(status_monitoramento);
CREATE INDEX idx_leads_cpf_vendedor ON leads(cpf, vendedor_id) WHERE cpf IS NOT NULL AND cpf != '';

-- View para CPFs duplicados (múltiplos vendedores trabalhando o mesmo CPF)
CREATE OR REPLACE VIEW public.vw_cpfs_duplicados AS
SELECT 
  l.cpf,
  COUNT(DISTINCT l.vendedor_id) as qtd_vendedores,
  ARRAY_AGG(DISTINCT l.vendedor_id) FILTER (WHERE l.vendedor_id IS NOT NULL) as vendedores_ids,
  ARRAY_AGG(DISTINCT l.nome) as nomes_usados,
  COUNT(*) as total_leads,
  MAX(l.created_at) as ultimo_lead
FROM leads l
WHERE l.cpf IS NOT NULL 
  AND l.cpf != ''
  AND l.vendedor_id IS NOT NULL
GROUP BY l.cpf
HAVING COUNT(DISTINCT l.vendedor_id) > 1;

-- View para métricas de vendedores (para análise de padrões)
CREATE OR REPLACE VIEW public.vw_metricas_vendedores AS
SELECT 
  p.id as vendedor_id,
  p.nome as vendedor_nome,
  COUNT(l.id) as total_leads,
  COUNT(CASE WHEN l.etapa = 'ganho' THEN 1 END) as leads_ganhos,
  COUNT(CASE WHEN l.etapa = 'perdido' THEN 1 END) as leads_perdidos,
  COUNT(CASE WHEN l.etapa NOT IN ('ganho', 'perdido') THEN 1 END) as leads_em_andamento,
  CASE 
    WHEN COUNT(l.id) > 0 
    THEN ROUND((COUNT(CASE WHEN l.etapa = 'ganho' THEN 1 END)::DECIMAL / COUNT(l.id)) * 100, 2)
    ELSE 0 
  END as taxa_conversao,
  CASE 
    WHEN COUNT(l.id) > 0 
    THEN ROUND((COUNT(CASE WHEN l.etapa = 'perdido' THEN 1 END)::DECIMAL / COUNT(l.id)) * 100, 2)
    ELSE 0 
  END as taxa_perda,
  COUNT(DISTINCT c.id) as total_cotacoes,
  COUNT(CASE WHEN c.status = 'aceita' THEN 1 END) as cotacoes_aceitas,
  COUNT(CASE WHEN c.status IN ('rascunho', 'enviada') AND c.created_at < NOW() - INTERVAL '30 days' THEN 1 END) as cotacoes_abandonadas,
  vm.status_monitoramento,
  vm.score_risco_acumulado
FROM profiles p
INNER JOIN user_roles ur ON ur.user_id = p.user_id
LEFT JOIN leads l ON l.vendedor_id = p.id
LEFT JOIN cotacoes c ON c.vendedor_id = p.id
LEFT JOIN vendedores_monitoramento vm ON vm.vendedor_id = p.id
WHERE ur.role IN ('vendedor_externo', 'vendedor_clt', 'gerente_comercial', 'supervisor_vendas')
  AND p.ativo = true
GROUP BY p.id, p.nome, vm.status_monitoramento, vm.score_risco_acumulado;

-- Enable RLS
ALTER TABLE auditoria_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores_monitoramento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Apenas diretores e gerentes podem ver/gerenciar auditoria
CREATE POLICY "Gestores podem ver alertas de auditoria" 
ON auditoria_vendedores FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('diretor', 'gerente_comercial', 'admin_master')
  )
);

CREATE POLICY "Gestores podem inserir alertas" 
ON auditoria_vendedores FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('diretor', 'gerente_comercial', 'admin_master')
  )
);

CREATE POLICY "Gestores podem atualizar alertas" 
ON auditoria_vendedores FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('diretor', 'gerente_comercial', 'admin_master')
  )
);

CREATE POLICY "Gestores podem ver monitoramento" 
ON vendedores_monitoramento FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('diretor', 'gerente_comercial', 'admin_master')
  )
);

CREATE POLICY "Gestores podem gerenciar monitoramento" 
ON vendedores_monitoramento FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('diretor', 'gerente_comercial', 'admin_master')
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_vendedores_monitoramento_updated_at
BEFORE UPDATE ON vendedores_monitoramento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE auditoria_vendedores IS 'Registra alertas de auditoria de vendedores para monitoramento de exclusividade';
COMMENT ON TABLE vendedores_monitoramento IS 'Status de monitoramento de vendedores com score de risco acumulado';
COMMENT ON VIEW vw_cpfs_duplicados IS 'View que identifica CPFs trabalhados por múltiplos vendedores';
COMMENT ON VIEW vw_metricas_vendedores IS 'Métricas consolidadas de vendedores para análise de padrões';