CREATE TABLE public.ocr_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  req_id TEXT,
  usuario_id UUID,
  cotacao_id UUID,
  associado_id UUID,
  tipo_esperado TEXT,
  tipo_detectado TEXT,
  arquivo_url_hash TEXT,
  mime TEXT,
  bytes INTEGER,
  is_pdf BOOLEAN DEFAULT false,
  has_native_text BOOLEAN DEFAULT false,
  native_text_len INTEGER DEFAULT 0,
  provider TEXT,
  modelo TEXT,
  latency_ms INTEGER,
  usage JSONB,
  confianca NUMERIC,
  legivel BOOLEAN,
  sugestao TEXT,
  sucesso BOOLEAN,
  truncated BOOLEAN DEFAULT false,
  used_retry BOOLEAN DEFAULT false,
  used_native_fallback BOOLEAN DEFAULT false,
  cpf_corrigido_via TEXT,
  status TEXT,
  motivo TEXT,
  erro TEXT,
  dados_extraidos JSONB
);

CREATE INDEX idx_ocr_logs_created_at ON public.ocr_execution_logs (created_at DESC);
CREATE INDEX idx_ocr_logs_status ON public.ocr_execution_logs (status, created_at DESC);
CREATE INDEX idx_ocr_logs_tipo ON public.ocr_execution_logs (tipo_detectado);
CREATE INDEX idx_ocr_logs_cotacao ON public.ocr_execution_logs (cotacao_id);
CREATE INDEX idx_ocr_logs_usuario ON public.ocr_execution_logs (usuario_id);

ALTER TABLE public.ocr_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor e Admin leem logs OCR"
ON public.ocr_execution_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

CREATE POLICY "Service role insere logs OCR"
ON public.ocr_execution_logs
FOR INSERT
TO service_role
WITH CHECK (true);