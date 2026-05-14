
UPDATE public.cobranca_csv_lotes
SET status = 'cancelado',
    observacao = COALESCE(observacao || E'\n', '') || 'Cancelado automaticamente: upload incompleto (is_last_chunk não recebido). Refazer upload.'
WHERE id IN (
  '8d077125-049a-4e24-b121-96ebc8c8d757',
  '593722ac-8e57-483b-b87f-52b155d16503'
) AND status = 'processando';
