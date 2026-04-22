
-- Adicionar campos de auditoria de reenvio de selfie biométrica em contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS biometric_resent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS biometric_resent_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS biometric_resend_count INTEGER NOT NULL DEFAULT 0;

-- Índice parcial para listagem rápida de contratos em revisão/rejeitados
CREATE INDEX IF NOT EXISTS idx_contratos_autentique_status_review_rejected
  ON public.contratos (autentique_status, updated_at DESC)
  WHERE autentique_status IN ('biometric_review', 'biometric_rejected');

COMMENT ON COLUMN public.contratos.biometric_resent_at IS 'Quando foi solicitado reenvio de selfie biométrica ao cliente';
COMMENT ON COLUMN public.contratos.biometric_resent_by IS 'Operador que solicitou o reenvio';
COMMENT ON COLUMN public.contratos.biometric_resend_count IS 'Quantidade de vezes que o reenvio foi solicitado';
