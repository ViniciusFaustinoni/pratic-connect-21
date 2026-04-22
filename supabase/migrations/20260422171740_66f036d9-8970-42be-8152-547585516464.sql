UPDATE public.veiculos
SET status = 'ativo', updated_at = NOW()
WHERE id = 'f5bd7c0f-691b-4b7f-9381-29d74ad471b1';

UPDATE public.servicos
SET status = 'cancelada',
    observacoes = COALESCE(observacoes, '') || E'\n[2026-04-22] Cancelada — veículo PYN0C82 cadastrado manualmente no SGA Hinova (codigo_veiculo=35776). Instalação não é mais necessária.',
    updated_at = NOW()
WHERE id = 'e36f0ffb-7be9-4b97-86af-b7bf730c0d4c';