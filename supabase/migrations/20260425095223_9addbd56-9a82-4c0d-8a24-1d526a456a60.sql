UPDATE public.sga_runtime_state 
SET backfill_financeiro_ativo = false,
    backfill_ultimo_heartbeat = now() - interval '10 minutes',
    backfill_cancelar_solicitado = false,
    backfill_expira_em = null;