
UPDATE public.servicos
SET profissional_id = NULL,
    rota_id = NULL,
    status = 'pendente',
    updated_at = now(),
    observacoes = COALESCE(observacoes, '') || E'\n[System ' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Desatribuído pelo Diretor — devolvido à fila de atribuição (placa LTS3A98).'
WHERE id = '5b0980bb-aa3b-4679-a8f5-0c8f5c86dc63'
  AND status NOT IN ('em_andamento','em_rota','concluida','aprovada','reprovada','aprovada_ressalvas','cancelada');

UPDATE public.fila_servicos
SET status = 'cancelado'
WHERE servico_id = '5b0980bb-aa3b-4679-a8f5-0c8f5c86dc63'
  AND status = 'aguardando';
