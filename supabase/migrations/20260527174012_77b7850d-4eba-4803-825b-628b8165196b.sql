ALTER TABLE public.rastreadores
  ADD COLUMN IF NOT EXISTS softruck_tentativas integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.rastreadores.softruck_tentativas IS
  'Contador de tentativas da edge softruck-ativar-dispositivo. Resetado em SUCCESS; usado pelo softruck-sweep-pendentes para parar de retentar em FAILED_PERMANENT.';

CREATE INDEX IF NOT EXISTS idx_rastreadores_softruck_pendentes
  ON public.rastreadores (softruck_integration_status, softruck_last_attempt_at)
  WHERE plataforma = 'softruck' AND status = 'instalado';