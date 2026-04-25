UPDATE public.sga_runtime_state
SET backfill_financeiro_ativo = true,
    backfill_cancelar_solicitado = false,
    backfill_expira_em = now() + interval '30 minutes'
WHERE id >= '00000000-0000-0000-0000-000000000000';