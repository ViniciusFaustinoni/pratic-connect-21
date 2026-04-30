-- Corrigir endereço do Alair Amorim (CEP estava 2500001 — 7 dígitos, inválido)
UPDATE public.associados
SET cep = '27961822',
    cidade = 'Macaé',
    bairro = 'Barra de Macaé',
    updated_at = now()
WHERE id = '503baa35-d56b-4b71-8284-08575f0d4ce4';

-- Resetar fila SGA para reprocessar o veículo
UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    erro_ultimo = NULL,
    proximo_reenvio_em = now()
WHERE veiculo_id = 'a01fd33c-5b94-4650-bf53-678cb5df343a';

-- Resetar status_sga do veículo
UPDATE public.veiculos
SET status_sga = 'pendente',
    updated_at = now()
WHERE id = 'a01fd33c-5b94-4650-bf53-678cb5df343a';