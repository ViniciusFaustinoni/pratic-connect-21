-- Adicionar colunas para posição final do chamado de assistência
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS posicao_final_lat NUMERIC(10, 7);
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS posicao_final_lng NUMERIC(10, 7);
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS posicao_final_capturada_em TIMESTAMPTZ;
ALTER TABLE chamados_assistencia ADD COLUMN IF NOT EXISTS distancia_percorrida_km NUMERIC(10, 2);

-- Adicionar comentários explicativos
COMMENT ON COLUMN chamados_assistencia.posicao_final_lat IS 'Latitude do rastreador no momento da conclusão do chamado';
COMMENT ON COLUMN chamados_assistencia.posicao_final_lng IS 'Longitude do rastreador no momento da conclusão do chamado';
COMMENT ON COLUMN chamados_assistencia.posicao_final_capturada_em IS 'Data/hora da captura da posição final';
COMMENT ON COLUMN chamados_assistencia.distancia_percorrida_km IS 'Distância percorrida entre posição inicial e final (Haversine)';