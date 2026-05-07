-- Corrigir ano_modelo do veículo LRA9681 (CLEBER LUIZ DE OLIVEIRA LIMA)
-- FIPE 827088-0 (YS 150 Fazer SED) só existe a partir de 2014; chassi 9C6KG0650E0004934 confirma ano-modelo 2014
UPDATE public.veiculos
SET ano_modelo = 2014,
    status_sga = 'pendente'
WHERE id = 'a474e4d6-b6fb-4bbd-bbc0-7e58402b1ab2';

-- Resetar fila SGA para reprocessar
UPDATE public.sga_sync_queue
SET status = 'pendente',
    tentativas = 0,
    proximo_reenvio_em = now(),
    erro_ultimo = NULL,
    etapa_parou = NULL
WHERE veiculo_id = 'a474e4d6-b6fb-4bbd-bbc0-7e58402b1ab2';