-- Helper de enfileiramento idempotente por correlation_id
CREATE OR REPLACE FUNCTION public.enqueue_integration(
  _integration integration_provider,
  _operation text,
  _payload jsonb,
  _correlation_id text DEFAULT NULL,
  _max_attempts int DEFAULT 5,
  _delay_seconds int DEFAULT 0,
  _created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_corr text := COALESCE(_correlation_id, gen_random_uuid()::text);
BEGIN
  -- Reaproveita item se já existe correlation_id em estado não-terminal
  IF _correlation_id IS NOT NULL THEN
    SELECT id INTO v_id
    FROM integration_retry_queue
    WHERE correlation_id = v_corr
      AND integration = _integration
      AND operation = _operation
      AND status IN ('pending','processing','failed')
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      UPDATE integration_retry_queue
         SET payload = _payload,
             status = 'pending',
             next_attempt_at = now() + make_interval(secs => _delay_seconds),
             updated_at = now()
       WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO integration_retry_queue (
    integration, operation, payload, correlation_id,
    max_attempts, status, next_attempt_at, created_by
  ) VALUES (
    _integration, _operation, _payload, v_corr,
    _max_attempts, 'pending', now() + make_interval(secs => _delay_seconds), _created_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Índice de seleção do worker
CREATE INDEX IF NOT EXISTS idx_integration_retry_queue_due
  ON integration_retry_queue (status, next_attempt_at)
  WHERE status IN ('pending','failed');

-- Cron a cada 1 min para processar fila
DO $$
BEGIN
  PERFORM cron.unschedule('process-integration-queue-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-integration-queue-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/process-integration-queue',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM4MDYwMiwiZXhwIjoyMDgyOTU2NjAyfQ.wYPUmokpuRpyuTbR7r1ANtxcwLwXiESxGCErdZ9VsjA"}'::jsonb,
    body:='{"trigger":"cron"}'::jsonb
  );
  $$
);