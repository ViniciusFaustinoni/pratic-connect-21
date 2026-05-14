UPDATE cobranca_runs
SET status = 'falhou',
    finished_at = now(),
    payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('erro', 'cleanup: worker abandonou em preparando (Hinova transitorio sem propagacao)', 'fase', 'preparacao')
WHERE status IN ('preparando','executando') AND finished_at IS NULL;