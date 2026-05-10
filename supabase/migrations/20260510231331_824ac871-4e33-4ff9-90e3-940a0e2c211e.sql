UPDATE solicitacoes_troca_titularidade
SET status = 'liberada_para_assinatura',
    aprovado_monitoramento_em = now(),
    aprovado_monitoramento_por = '37beadcf-284b-4a2c-88a0-6efa8cae60d9'
WHERE id = '31330683-a143-4a3e-9a1f-7db6d112a165'
  AND status = 'aguardando_monitoramento';