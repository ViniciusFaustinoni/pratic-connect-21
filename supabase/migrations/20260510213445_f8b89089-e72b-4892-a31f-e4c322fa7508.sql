UPDATE public.cotacoes
SET prioridade = 'alta', origem_troca_titularidade = true
WHERE id IN (
  SELECT cotacao_id FROM public.solicitacoes_troca_titularidade
  WHERE status IN ('aguardando_monitoramento','aguardando_vistoria','liberada_para_assinatura')
    AND cotacao_id IS NOT NULL
);