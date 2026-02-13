
-- Adicionar colunas de upload_token na tabela sinistros
ALTER TABLE public.sinistros 
ADD COLUMN IF NOT EXISTS upload_token text UNIQUE,
ADD COLUMN IF NOT EXISTS upload_token_expires_at timestamptz;

-- Política RLS para permitir leitura anônima de sinistros pelo upload_token
CREATE POLICY "Acesso público por upload_token"
ON public.sinistros
FOR SELECT
TO anon
USING (upload_token IS NOT NULL AND upload_token_expires_at > now());

-- Política RLS para permitir leitura anônima de sinistro_documentos pelo sinistro com token válido
CREATE POLICY "Acesso público documentos por upload_token"
ON public.sinistro_documentos
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.sinistros s
    WHERE s.id = sinistro_id
    AND s.upload_token IS NOT NULL
    AND s.upload_token_expires_at > now()
  )
);

-- Política para permitir update anônimo de sinistro_documentos (para marcar como enviado)
CREATE POLICY "Update público documentos por upload_token"
ON public.sinistro_documentos
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.sinistros s
    WHERE s.id = sinistro_id
    AND s.upload_token IS NOT NULL
    AND s.upload_token_expires_at > now()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sinistros s
    WHERE s.id = sinistro_id
    AND s.upload_token IS NOT NULL
    AND s.upload_token_expires_at > now()
  )
);
