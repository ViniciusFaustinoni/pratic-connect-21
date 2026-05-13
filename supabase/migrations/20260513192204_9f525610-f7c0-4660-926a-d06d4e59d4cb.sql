-- Data fix: vincular a solicitação de troca de titularidade do veículo KOU6D37
-- à cotação 3f0408b9-939d-47c9-890a-0dc1d98bd43c, que ficou órfã porque
-- vincular-cotacao-troca não foi invocada quando a cotação foi criada.
UPDATE public.solicitacoes_troca_titularidade
   SET cotacao_id = '3f0408b9-939d-47c9-890a-0dc1d98bd43c',
       updated_at = now()
 WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d'
   AND cotacao_id IS NULL;