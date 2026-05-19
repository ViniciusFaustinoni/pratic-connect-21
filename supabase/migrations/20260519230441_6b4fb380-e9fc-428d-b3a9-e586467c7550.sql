DELETE FROM public.solicitacoes_troca_titularidade
 WHERE veiculo_id = '36e4ecc5-1c1f-46c0-b6e8-de4fb9271ee6';

DELETE FROM public.cotacoes
 WHERE tipo_entrada = 'troca_titularidade';

UPDATE public.veiculos
   SET em_troca_titularidade = false
 WHERE id = '36e4ecc5-1c1f-46c0-b6e8-de4fb9271ee6';