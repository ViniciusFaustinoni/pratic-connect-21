-- Fix old invalidation logs with NULL associado_id/veiculo_id for Marcus Vinicius
UPDATE sga_sync_logs 
SET associado_id = 'c19106fb-e442-48e0-8925-4f0d4cff54e0', 
    veiculo_id = 'c165a7e6-ef8f-483c-b891-6fa3ec84ec4b'
WHERE action = 'invalidar_codigo_associado' 
AND associado_id IS NULL 
AND veiculo_id IS NULL
AND created_at >= '2026-03-12';

-- Mark Marcus's queue entry as falha_permanente
UPDATE sga_sync_queue 
SET status = 'falha_permanente',
    erro_ultimo = 'DEADLOCK HINOVA: CPF existe mas está indisponível/deletado (código 29403). Requer reativação manual no painel Hinova.',
    ultima_tentativa_em = now()
WHERE associado_id = 'c19106fb-e442-48e0-8925-4f0d4cff54e0'
AND veiculo_id = 'c165a7e6-ef8f-483c-b891-6fa3ec84ec4b';