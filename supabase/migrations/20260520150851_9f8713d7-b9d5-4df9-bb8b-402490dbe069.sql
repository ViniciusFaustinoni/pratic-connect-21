UPDATE public.solicitacoes_troca_titularidade
SET status = 'aguardando_termo_cancelamento',
    updated_at = now()
WHERE status = 'cotacao_em_andamento'
  AND termo_cancelamento_assinado_em IS NULL;