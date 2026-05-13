-- 1) Desvincular a cotação fantasma da solicitação
UPDATE public.solicitacoes_troca_titularidade
SET cotacao_id = NULL,
    updated_at = now()
WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d'
  AND cotacao_id = 'e82bd534-690f-4967-9304-db18b512a130';

-- 2) Apagar a cotação rascunho criada prematuramente (sem plano, sem vendedor)
DELETE FROM public.cotacoes
WHERE id = 'e82bd534-690f-4967-9304-db18b512a130'
  AND status = 'rascunho';