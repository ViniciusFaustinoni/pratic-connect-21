
UPDATE cotacoes SET contrato_gerado_id = NULL WHERE id = 'd66e2a78-a3c8-4839-bfa7-742bcd7c2b5b';
DELETE FROM agendamentos_base WHERE cotacao_id = 'd66e2a78-a3c8-4839-bfa7-742bcd7c2b5b';
DELETE FROM contratos WHERE cotacao_id = 'd66e2a78-a3c8-4839-bfa7-742bcd7c2b5b';
DELETE FROM cotacoes WHERE id = 'd66e2a78-a3c8-4839-bfa7-742bcd7c2b5b';

UPDATE solicitacoes_troca_titularidade
SET cotacao_id = NULL,
    aprovado_cadastro_em = NULL,
    aprovado_monitoramento_em = NULL,
    servico_vistoria_id = NULL,
    motivo_reprovacao = NULL,
    status = 'liberada_para_assinatura',
    updated_at = now()
WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d';
