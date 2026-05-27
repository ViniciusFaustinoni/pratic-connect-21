
CREATE TABLE public.softruck_gps_poll_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rastreador_id UUID NOT NULL REFERENCES public.rastreadores(id) ON DELETE CASCADE,
  softruck_device_id TEXT NOT NULL,
  softruck_vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 6,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  last_response JSONB,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_softruck_gps_poll_pending
  ON public.softruck_gps_poll_queue(status, next_run_at)
  WHERE status = 'pending';

CREATE INDEX idx_softruck_gps_poll_rastreador
  ON public.softruck_gps_poll_queue(rastreador_id);

GRANT SELECT ON public.softruck_gps_poll_queue TO authenticated;
GRANT ALL ON public.softruck_gps_poll_queue TO service_role;

ALTER TABLE public.softruck_gps_poll_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read softruck gps poll"
  ON public.softruck_gps_poll_queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER set_softruck_gps_poll_updated_at
  BEFORE UPDATE ON public.softruck_gps_poll_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
