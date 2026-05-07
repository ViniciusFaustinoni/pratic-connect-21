UPDATE public.solicitacoes_troca_titularidade
SET status = 'cancelada',
    motivo_reprovacao = COALESCE(motivo_reprovacao, 'Cancelada por orfandade — cotação não concluída, liberando placa para novo cadastro'),
    updated_at = now()
WHERE id = 'b4c8b25d-b3c8-4789-91da-dc355b20d909';