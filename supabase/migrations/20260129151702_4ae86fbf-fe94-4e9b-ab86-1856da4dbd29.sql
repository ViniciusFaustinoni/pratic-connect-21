-- Tabela para registrar todos os webhooks recebidos da Softruck
CREATE TABLE public.softruck_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_tipo VARCHAR(100) NOT NULL,
  evento_acao VARCHAR(50),
  payload JSONB NOT NULL,
  device_id VARCHAR(100),
  vehicle_id VARCHAR(100),
  imei VARCHAR(50),
  placa VARCHAR(20),
  rastreador_id UUID REFERENCES rastreadores(id),
  veiculo_id UUID REFERENCES veiculos(id),
  processado BOOLEAN DEFAULT FALSE,
  processado_em TIMESTAMPTZ,
  erro_processamento TEXT,
  alerta_gerado BOOLEAN DEFAULT FALSE,
  alerta_id UUID,
  ip_origem VARCHAR(50),
  headers_recebidos JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para performance
CREATE INDEX idx_softruck_eventos_tipo ON softruck_eventos(evento_tipo);
CREATE INDEX idx_softruck_eventos_created ON softruck_eventos(created_at DESC);
CREATE INDEX idx_softruck_eventos_rastreador ON softruck_eventos(rastreador_id);
CREATE INDEX idx_softruck_eventos_veiculo ON softruck_eventos(veiculo_id);
CREATE INDEX idx_softruck_eventos_processado ON softruck_eventos(processado) WHERE processado = FALSE;
CREATE INDEX idx_softruck_eventos_device_id ON softruck_eventos(device_id);
CREATE INDEX idx_softruck_eventos_imei ON softruck_eventos(imei);

-- Habilitar RLS
ALTER TABLE public.softruck_eventos ENABLE ROW LEVEL SECURITY;

-- Policies - somente funcionarios podem ver
CREATE POLICY "Funcionarios podem ver eventos"
ON public.softruck_eventos
FOR SELECT
USING (public.am_i_funcionario());

-- Permitir insert via service role (edge functions)
CREATE POLICY "Service role pode inserir eventos"
ON public.softruck_eventos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role pode atualizar eventos"
ON public.softruck_eventos
FOR UPDATE
USING (true);

-- Adicionar comentarios
COMMENT ON TABLE public.softruck_eventos IS 'Log de todos os webhooks recebidos da plataforma Softruck';
COMMENT ON COLUMN public.softruck_eventos.evento_tipo IS 'Tipo do evento: DEVICES.ASSOCIATED, DEVICES.DISASSOCIATED, VEHICLES.CREATED, VEHICLES.DELETED, device-events';
COMMENT ON COLUMN public.softruck_eventos.evento_acao IS 'Ação específica dentro do tipo de evento';
COMMENT ON COLUMN public.softruck_eventos.processado IS 'Se o evento já foi processado pelo sistema';
COMMENT ON COLUMN public.softruck_eventos.alerta_gerado IS 'Se um alerta crítico foi gerado para este evento';