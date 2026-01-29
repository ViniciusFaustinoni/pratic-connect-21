-- Adicionar campos de posição na tabela sinistros para evidências de GPS

-- Posição informada pelo usuário no momento do comunicado
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS latitude_informada DECIMAL(10,8);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS longitude_informada DECIMAL(11,8);

-- Posição do rastreador capturada automaticamente no momento do comunicado
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS rastreador_lat_momento DECIMAL(10,8);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS rastreador_lng_momento DECIMAL(11,8);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS rastreador_posicao_capturada_em TIMESTAMPTZ;

-- Snapshot do trajeto para auditoria (24h antes do evento)
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS snapshot_trajeto_json JSONB;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS snapshot_salvo_em TIMESTAMPTZ;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS snapshot_salvo_por UUID REFERENCES public.profiles(id);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.sinistros.latitude_informada IS 'Latitude informada pelo usuário no mapa ao comunicar o evento';
COMMENT ON COLUMN public.sinistros.longitude_informada IS 'Longitude informada pelo usuário no mapa ao comunicar o evento';
COMMENT ON COLUMN public.sinistros.rastreador_lat_momento IS 'Latitude do rastreador capturada automaticamente no momento do comunicado';
COMMENT ON COLUMN public.sinistros.rastreador_lng_momento IS 'Longitude do rastreador capturada automaticamente no momento do comunicado';
COMMENT ON COLUMN public.sinistros.rastreador_posicao_capturada_em IS 'Data/hora da última posição do rastreador no momento da captura';
COMMENT ON COLUMN public.sinistros.snapshot_trajeto_json IS 'Snapshot do trajeto 24h salvo como evidência para auditoria';
COMMENT ON COLUMN public.sinistros.snapshot_salvo_em IS 'Quando o snapshot do trajeto foi salvo';
COMMENT ON COLUMN public.sinistros.snapshot_salvo_por IS 'Usuário que salvou o snapshot do trajeto';