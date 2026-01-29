-- =====================================================
-- MIGRAÇÃO: Sistema de Acionamento de Roubo/Furto
-- =====================================================

-- 1. Criar tabela de acionamentos de roubo/furto
CREATE TABLE IF NOT EXISTS public.acionamentos_roubo_furto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referências
  sinistro_id UUID REFERENCES public.sinistros(id) ON DELETE SET NULL,
  chamado_assistencia_id UUID REFERENCES public.chamados_assistencia(id) ON DELETE SET NULL,
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  rastreador_id UUID REFERENCES public.rastreadores(id) ON DELETE SET NULL,
  associado_id UUID REFERENCES public.associados(id) ON DELETE SET NULL,
  
  -- Dados do acionamento
  tipo_origem VARCHAR(50) NOT NULL CHECK (tipo_origem IN ('sinistro', 'assistencia', 'diretoria', 'manual')),
  protocolo_externo VARCHAR(100),
  plataforma VARCHAR(30) DEFAULT 'rede_veiculos',
  
  -- Quem solicitou
  solicitado_por UUID REFERENCES public.profiles(id),
  solicitado_por_nome VARCHAR(255),
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  
  -- Autorização (para acionamentos que requerem aprovação)
  autorizado_por UUID REFERENCES public.profiles(id),
  autorizado_por_nome VARCHAR(255),
  autorizado_em TIMESTAMPTZ,
  
  -- Status do acionamento
  status VARCHAR(30) DEFAULT 'solicitado' CHECK (status IN (
    'solicitado', 'autorizado', 'enviado', 'confirmado', 'erro', 'cancelado', 'encerrado'
  )),
  
  -- Resposta da API
  api_request JSONB,
  api_response JSONB,
  api_status_code INTEGER,
  erro_mensagem TEXT,
  
  -- Dados do veículo no momento
  ultima_posicao_lat DECIMAL(10, 8),
  ultima_posicao_lng DECIMAL(11, 8),
  ultima_posicao_data TIMESTAMPTZ,
  
  -- Observações
  observacoes TEXT,
  
  -- Encerramento
  encerrado_em TIMESTAMPTZ,
  encerrado_por UUID REFERENCES public.profiles(id),
  motivo_encerramento TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_acionamentos_sinistro_id ON public.acionamentos_roubo_furto(sinistro_id);
CREATE INDEX IF NOT EXISTS idx_acionamentos_chamado_id ON public.acionamentos_roubo_furto(chamado_assistencia_id);
CREATE INDEX IF NOT EXISTS idx_acionamentos_veiculo_id ON public.acionamentos_roubo_furto(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_acionamentos_rastreador_id ON public.acionamentos_roubo_furto(rastreador_id);
CREATE INDEX IF NOT EXISTS idx_acionamentos_status ON public.acionamentos_roubo_furto(status);
CREATE INDEX IF NOT EXISTS idx_acionamentos_tipo_origem ON public.acionamentos_roubo_furto(tipo_origem);
CREATE INDEX IF NOT EXISTS idx_acionamentos_created_at ON public.acionamentos_roubo_furto(created_at DESC);

-- 2. Adicionar campos de modo rastreamento na tabela rastreadores
ALTER TABLE public.rastreadores 
  ADD COLUMN IF NOT EXISTS modo_rastreamento VARCHAR(20) DEFAULT 'normal';

ALTER TABLE public.rastreadores 
  ADD COLUMN IF NOT EXISTS modo_ativado_em TIMESTAMPTZ;

ALTER TABLE public.rastreadores 
  ADD COLUMN IF NOT EXISTS modo_ativado_por UUID REFERENCES public.profiles(id);

ALTER TABLE public.rastreadores 
  ADD COLUMN IF NOT EXISTS acionamento_ativo_id UUID REFERENCES public.acionamentos_roubo_furto(id);

-- Constraint para modo_rastreamento (adicionar apenas se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rastreadores_modo_rastreamento_check'
  ) THEN
    ALTER TABLE public.rastreadores 
      ADD CONSTRAINT rastreadores_modo_rastreamento_check 
      CHECK (modo_rastreamento IN ('normal', 'intensivo', 'emergencia'));
  END IF;
END $$;

-- 3. Criar tabela de histórico de acionamentos
CREATE TABLE IF NOT EXISTS public.acionamentos_roubo_furto_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acionamento_id UUID NOT NULL REFERENCES public.acionamentos_roubo_furto(id) ON DELETE CASCADE,
  status_anterior VARCHAR(30),
  status_novo VARCHAR(30) NOT NULL,
  usuario_id UUID REFERENCES public.profiles(id),
  usuario_nome VARCHAR(255),
  observacao TEXT,
  dados_extras JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acionamentos_hist_acionamento ON public.acionamentos_roubo_furto_historico(acionamento_id);

-- 4. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_acionamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_acionamentos_updated_at ON public.acionamentos_roubo_furto;
CREATE TRIGGER trigger_acionamentos_updated_at
  BEFORE UPDATE ON public.acionamentos_roubo_furto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_acionamentos_updated_at();

-- 5. Trigger para registrar histórico de mudança de status
CREATE OR REPLACE FUNCTION public.fn_acionamento_historico()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.acionamentos_roubo_furto_historico (
      acionamento_id, status_anterior, status_novo
    ) VALUES (
      NEW.id, OLD.status, NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_acionamento_historico ON public.acionamentos_roubo_furto;
CREATE TRIGGER trigger_acionamento_historico
  AFTER UPDATE ON public.acionamentos_roubo_furto
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_acionamento_historico();

-- 6. Enable RLS
ALTER TABLE public.acionamentos_roubo_furto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acionamentos_roubo_furto_historico ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para acionamentos_roubo_furto
CREATE POLICY "Funcionários podem visualizar acionamentos"
  ON public.acionamentos_roubo_furto
  FOR SELECT
  USING (public.is_funcionario(auth.uid()));

CREATE POLICY "Funcionários podem criar acionamentos"
  ON public.acionamentos_roubo_furto
  FOR INSERT
  WITH CHECK (public.is_funcionario(auth.uid()));

CREATE POLICY "Funcionários podem atualizar acionamentos"
  ON public.acionamentos_roubo_furto
  FOR UPDATE
  USING (public.is_funcionario(auth.uid()));

-- 8. Políticas RLS para histórico
CREATE POLICY "Funcionários podem visualizar histórico de acionamentos"
  ON public.acionamentos_roubo_furto_historico
  FOR SELECT
  USING (public.is_funcionario(auth.uid()));

CREATE POLICY "Funcionários podem inserir histórico de acionamentos"
  ON public.acionamentos_roubo_furto_historico
  FOR INSERT
  WITH CHECK (public.is_funcionario(auth.uid()));

-- 9. Comentários para documentação
COMMENT ON TABLE public.acionamentos_roubo_furto IS 'Registro de acionamentos de roubo/furto para recuperação de veículos via plataforma de rastreamento';
COMMENT ON COLUMN public.acionamentos_roubo_furto.tipo_origem IS 'Origem do acionamento: sinistro (automático via criação de sinistro), assistencia (via chamado 24h), diretoria (autorização manual), manual (operador)';
COMMENT ON COLUMN public.acionamentos_roubo_furto.status IS 'Status do acionamento: solicitado, autorizado, enviado, confirmado, erro, cancelado, encerrado';
COMMENT ON COLUMN public.rastreadores.modo_rastreamento IS 'Modo de rastreamento: normal (5-10min), intensivo (30s), emergencia (tempo real)';