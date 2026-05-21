UPDATE public.cotacoes c
SET
  status = 'cancelada',
  status_contratacao = 'cancelada',
  cancelada_em = COALESCE(c.cancelada_em, now()),
  motivo_cancelamento = COALESCE(
    c.motivo_cancelamento,
    'Saneamento: troca de titularidade em estado terminal não-efetivada'
  ),
  token_publico = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
FROM public.solicitacoes_troca_titularidade s
WHERE s.cotacao_id = c.id
  AND c.origem_troca_titularidade = true
  AND c.status::text <> 'cancelada'
  AND s.status IN ('cancelada', 'expirada', 'reprovada_cadastro', 'reprovada_monitoramento');