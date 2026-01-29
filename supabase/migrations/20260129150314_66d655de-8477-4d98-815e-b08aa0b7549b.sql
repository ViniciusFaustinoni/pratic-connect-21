-- Tabela para rastrear comandos enviados a rastreadores (bloqueio/desbloqueio)
CREATE TABLE public.rastreadores_comandos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID REFERENCES rastreadores(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  plataforma VARCHAR(50) NOT NULL,
  tipo_comando VARCHAR(50) NOT NULL, -- 'bloquear', 'desbloquear', 'localizar_agora'
  origem VARCHAR(50) NOT NULL DEFAULT 'monitoramento', -- 'monitoramento', 'sinistro', 'assistencia', 'diretoria'
  origem_id UUID, -- ID do sinistro ou chamado relacionado
  solicitado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  solicitado_por_nome VARCHAR(255),
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  autorizado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  autorizado_por_nome VARCHAR(255),
  autorizado_em TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente', -- 'pendente', 'autorizado', 'enviado', 'confirmado', 'erro', 'cancelado'
  metodo_envio VARCHAR(50), -- 'api', 'sms', 'manual'
  telefone_destino VARCHAR(20),
  comando_enviado TEXT,
  api_request JSONB,
  api_response JSONB,
  erro_mensagem TEXT,
  confirmado_em TIMESTAMPTZ,
  observacoes TEXT,
  motivo TEXT NOT NULL, -- Obrigatorio para auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX idx_rastreadores_comandos_rastreador ON rastreadores_comandos(rastreador_id);
CREATE INDEX idx_rastreadores_comandos_veiculo ON rastreadores_comandos(veiculo_id);
CREATE INDEX idx_rastreadores_comandos_status ON rastreadores_comandos(status);
CREATE INDEX idx_rastreadores_comandos_origem ON rastreadores_comandos(origem, origem_id);
CREATE INDEX idx_rastreadores_comandos_solicitado_em ON rastreadores_comandos(solicitado_em DESC);

-- RLS
ALTER TABLE public.rastreadores_comandos ENABLE ROW LEVEL SECURITY;

-- Policy para funcionários visualizarem comandos
CREATE POLICY "Funcionarios podem ver comandos"
ON public.rastreadores_comandos
FOR SELECT
USING (public.is_funcionario(auth.uid()));

-- Policy para funcionários criarem comandos
CREATE POLICY "Funcionarios podem criar comandos"
ON public.rastreadores_comandos
FOR INSERT
WITH CHECK (public.is_funcionario(auth.uid()));

-- Policy para funcionários atualizarem comandos
CREATE POLICY "Funcionarios podem atualizar comandos"
ON public.rastreadores_comandos
FOR UPDATE
USING (public.is_funcionario(auth.uid()));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_rastreadores_comandos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_rastreadores_comandos_updated_at
BEFORE UPDATE ON rastreadores_comandos
FOR EACH ROW
EXECUTE FUNCTION update_rastreadores_comandos_updated_at();

-- Comentários
COMMENT ON TABLE rastreadores_comandos IS 'Histórico e status de comandos enviados para rastreadores';
COMMENT ON COLUMN rastreadores_comandos.tipo_comando IS 'Tipo: bloquear, desbloquear, localizar_agora';
COMMENT ON COLUMN rastreadores_comandos.origem IS 'Origem: monitoramento, sinistro, assistencia, diretoria';
COMMENT ON COLUMN rastreadores_comandos.status IS 'Status: pendente, autorizado, enviado, confirmado, erro, cancelado';
COMMENT ON COLUMN rastreadores_comandos.metodo_envio IS 'Método: api, sms, manual';
COMMENT ON COLUMN rastreadores_comandos.motivo IS 'Motivo obrigatório para auditoria';