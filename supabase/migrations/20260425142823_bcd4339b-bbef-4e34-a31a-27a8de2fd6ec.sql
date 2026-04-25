UPDATE public.sga_runtime_state
SET backfill_cancelar_solicitado = false,
    backfill_financeiro_ativo = true,
    backfill_iniciado_em = now(),
    backfill_expira_em = now() + interval '60 minutes',
    backfill_ultimo_heartbeat = now(),
    updated_at = now();