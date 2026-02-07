-- ============================================
-- Expandir enum status_rastreador com novos status
-- ============================================
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'retorno_base';
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'triagem';
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'em_analise_plataforma';
ALTER TYPE status_rastreador ADD VALUE IF NOT EXISTS 'em_garantia';

-- ============================================
-- Criar tabela de Manutenção Interna (Processo 2)
-- ============================================
CREATE TABLE public.rastreador_manutencao_interna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID NOT NULL REFERENCES rastreadores(id) ON DELETE CASCADE,
  servico_origem_id UUID REFERENCES servicos(id) ON DELETE SET NULL,
  
  -- Status do processo interno
  etapa VARCHAR(30) NOT NULL DEFAULT 'aguardando_triagem' 
    CHECK (etapa IN (
      'aguardando_triagem',
      'em_triagem',
      'em_analise_plataforma',
      'em_garantia',
      'concluido_estoque',
      'descartado'
    )),
  
  -- Diagnóstico
  diagnostico_inicial TEXT,
  defeito_identificado VARCHAR(100),
  
  -- Encaminhamentos
  encaminhado_para VARCHAR(50),
  data_encaminhamento TIMESTAMPTZ,
  numero_protocolo_externo VARCHAR(100),
  
  -- Laudo/Resultado
  laudo_externo TEXT,
  recuperavel BOOLEAN,
  data_retorno TIMESTAMPTZ,
  
  -- Resolução
  acao_tomada TEXT,
  resolvido_por UUID REFERENCES profiles(id),
  resolvido_em TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Índices para performance
CREATE INDEX idx_manut_interna_rastreador ON rastreador_manutencao_interna(rastreador_id);
CREATE INDEX idx_manut_interna_etapa ON rastreador_manutencao_interna(etapa);
CREATE INDEX idx_manut_interna_created ON rastreador_manutencao_interna(created_at DESC);

-- ============================================
-- Adicionar coluna de destino na tabela servicos
-- ============================================
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS 
  rastreador_destino_pos_substituicao VARCHAR(30) 
  CHECK (rastreador_destino_pos_substituicao IN ('retorno_base', 'baixado'));

-- ============================================
-- Trigger para updated_at automático
-- ============================================
CREATE TRIGGER update_rastreador_manutencao_interna_updated_at
  BEFORE UPDATE ON rastreador_manutencao_interna
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies para rastreador_manutencao_interna
-- ============================================
ALTER TABLE rastreador_manutencao_interna ENABLE ROW LEVEL SECURITY;

-- Coordenador Monitoramento e Diretor podem ver todos
CREATE POLICY "Coordenador e Diretor podem ver manutencao interna"
ON rastreador_manutencao_interna
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('diretor', 'coordenador_monitoramento')
  )
);

-- Coordenador Monitoramento e Diretor podem inserir
CREATE POLICY "Coordenador e Diretor podem inserir manutencao interna"
ON rastreador_manutencao_interna
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('diretor', 'coordenador_monitoramento')
  )
);

-- Coordenador Monitoramento e Diretor podem atualizar
CREATE POLICY "Coordenador e Diretor podem atualizar manutencao interna"
ON rastreador_manutencao_interna
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('diretor', 'coordenador_monitoramento')
  )
);

-- Apenas Diretor pode deletar (descarte definitivo requer aprovação)
CREATE POLICY "Apenas Diretor pode deletar manutencao interna"
ON rastreador_manutencao_interna
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'diretor'
  )
);