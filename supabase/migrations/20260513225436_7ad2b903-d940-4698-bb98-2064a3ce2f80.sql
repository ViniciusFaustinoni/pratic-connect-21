UPDATE public.solicitacoes_troca_titularidade
SET status = 'aguardando_cadastro',
    aprovado_cadastro_em = NULL,
    aprovado_cadastro_por = NULL,
    observacao_cadastro = NULL,
    updated_at = now()
WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d'
  AND efetivada_em IS NULL;