
-- 1) Desvincular a solicitação de troca para liberar a re-criação da cotação
UPDATE public.solicitacoes_troca_titularidade
SET cotacao_id = NULL,
    updated_at = now()
WHERE id = '06037fb8-84bb-4856-a723-2b2baea55c5d';

-- 2) Apagar as duas cotações órfãs (sem contratos/instalações/serviços vinculados — verificado)
DELETE FROM public.cotacoes
WHERE id IN (
  '0f5e1db1-7b1d-4fe9-9ae1-30becdc18c90',
  'd54499fc-f325-4d3e-bf09-dffd88c35e40'
);
