-- Campos de rastreador na tabela chamados_assistencia
ALTER TABLE chamados_assistencia 
  ADD COLUMN rastreador_lat DECIMAL(10,8),
  ADD COLUMN rastreador_lng DECIMAL(11,8),
  ADD COLUMN rastreador_posicao_capturada_em TIMESTAMPTZ,
  ADD COLUMN rastreador_endereco TEXT;

-- Comentários descritivos
COMMENT ON COLUMN chamados_assistencia.rastreador_lat IS 'Latitude capturada do rastreador ao criar chamado';
COMMENT ON COLUMN chamados_assistencia.rastreador_lng IS 'Longitude capturada do rastreador ao criar chamado';
COMMENT ON COLUMN chamados_assistencia.rastreador_posicao_capturada_em IS 'Momento em que a posição do rastreador foi capturada';
COMMENT ON COLUMN chamados_assistencia.rastreador_endereco IS 'Endereço geocodificado da posição do rastreador';

-- Campos de posição na tabela chamados_assistencia_historico
ALTER TABLE chamados_assistencia_historico
  ADD COLUMN latitude DECIMAL(10,8),
  ADD COLUMN longitude DECIMAL(11,8),
  ADD COLUMN posicao_fonte VARCHAR(20);

-- Comentários
COMMENT ON COLUMN chamados_assistencia_historico.latitude IS 'Latitude no momento da mudança de status';
COMMENT ON COLUMN chamados_assistencia_historico.longitude IS 'Longitude no momento da mudança de status';
COMMENT ON COLUMN chamados_assistencia_historico.posicao_fonte IS 'Fonte da posição: rastreador, gps ou manual';