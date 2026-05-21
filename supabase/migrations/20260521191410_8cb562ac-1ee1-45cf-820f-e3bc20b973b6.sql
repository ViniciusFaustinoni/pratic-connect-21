UPDATE public.contratos
SET status = 'cancelado',
    data_cancelamento = now(),
    updated_at = now()
WHERE status = 'assinado'
  AND origem_troca_titularidade_id IN (
    SELECT id FROM public.solicitacoes_troca_titularidade
    WHERE status IN ('cancelada','expirada')
  );