-- Reverter solicitação de troca para fase "cotação em andamento" (antes da escolha do plano)
UPDATE public.solicitacoes_troca_titularidade
SET status = 'cotacao_em_andamento',
    aprovado_cadastro_em = NULL,
    aprovado_cadastro_por = NULL,
    aprovado_monitoramento_em = NULL,
    aprovado_monitoramento_por = NULL,
    motivo_reprovacao = NULL,
    servico_vistoria_id = NULL,
    tipo_vistoria_troca = NULL,
    servico_manutencao_id = NULL,
    expirada_em = NULL,
    updated_at = now()
WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';

-- Resetar cotação para rascunho sem plano selecionado (volta ao passo de escolha do plano)
UPDATE public.cotacoes
SET status = 'rascunho',
    plano_id = NULL,
    updated_at = now()
WHERE id = 'd411a54c-8ca4-4356-996d-569ebf93e94d';