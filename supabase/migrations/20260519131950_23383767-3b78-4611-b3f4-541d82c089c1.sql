UPDATE public.cotacoes
SET status = 'recusada',
    motivo_cancelamento = 'Liberação manual de placa - rascunho preso (fluxo de teste)',
    cancelada_em = now()
WHERE id = 'c46ba7dc-24cc-425b-a88c-389a3d3f04e6'
  AND status = 'rascunho';