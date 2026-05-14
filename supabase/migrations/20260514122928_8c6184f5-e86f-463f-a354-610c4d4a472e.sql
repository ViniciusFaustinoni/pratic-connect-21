UPDATE public.solicitacoes_troca_titularidade
SET status = 'aguardando_cadastro',
    aprovado_cadastro_em = NULL,
    aprovado_monitoramento_em = NULL,
    aprovado_cadastro_por = NULL,
    aprovado_monitoramento_por = NULL,
    motivo_reprovacao = NULL,
    servico_vistoria_id = NULL,
    tipo_vistoria_troca = NULL,
    servico_manutencao_id = NULL,
    expirada_em = NULL,
    updated_at = now()
WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';