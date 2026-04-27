
UPDATE public.servicos
SET profissional_id = NULL,
    rota_id = NULL,
    status = 'pendente'::status_servico,
    em_rota_em = NULL,
    iniciada_em = NULL,
    updated_at = now(),
    observacoes = COALESCE(observacoes, '') || E'\n[System ' || to_char(now(),'YYYY-MM-DD HH24:MI') || '] Desatribuído pelo Diretor — devolvido à fila (placa LTS3A98).'
WHERE id = '5b0980bb-aa3b-4679-a8f5-0c8f5c86dc63';
