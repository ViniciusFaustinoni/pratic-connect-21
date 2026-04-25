
UPDATE public.sga_runtime_state
SET backfill_cancelar_solicitado = true,
    backfill_financeiro_ativo = false,
    updated_at = now();
