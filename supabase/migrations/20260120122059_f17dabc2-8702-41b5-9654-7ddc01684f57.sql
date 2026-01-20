-- Adicionar coluna visivel_cliente para ocultar foto do local do rastreador
ALTER TABLE public.vistoria_fotos 
ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN public.vistoria_fotos.visivel_cliente IS 'Se false, a foto não será visível na área do cliente (ex: local do rastreador)';

-- Adicionar coluna para armazenar URL do vídeo 360 na vistoria
ALTER TABLE public.vistorias
ADD COLUMN IF NOT EXISTS video_360_url text;

COMMENT ON COLUMN public.vistorias.video_360_url IS 'URL do vídeo 360 graus obrigatório da vistoria';

-- Adicionar colunas para fotos de recusa
ALTER TABLE public.vistorias
ADD COLUMN IF NOT EXISTS fotos_recusa text[];

COMMENT ON COLUMN public.vistorias.fotos_recusa IS 'URLs das fotos de evidência quando veículo é recusado (até 5 fotos)';

-- Criar bucket para vídeos de vistoria
INSERT INTO storage.buckets (id, name, public)
VALUES ('vistoria-videos', 'vistoria-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para o bucket de vídeos
CREATE POLICY "Vídeos de vistoria são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'vistoria-videos');

CREATE POLICY "Usuários autenticados podem fazer upload de vídeos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vistoria-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar vídeos"
ON storage.objects FOR DELETE
USING (bucket_id = 'vistoria-videos' AND auth.role() = 'authenticated');