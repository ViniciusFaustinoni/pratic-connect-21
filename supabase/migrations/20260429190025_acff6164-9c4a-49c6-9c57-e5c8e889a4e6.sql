-- Reset do veículo TCU6B84 (TOVAR RODRIGUES LIMA) para reprocessamento após correção
-- da raiz do bug de auth 401 em cadeia (cadastrar_associado → cadastrar_veiculo).
UPDATE veiculos
   SET status_sga = 'pendente'
 WHERE id = '49639ef3-8b03-4ebf-9b5e-adb2b44a61a4';

DELETE FROM sga_sync_queue
 WHERE veiculo_id = '49639ef3-8b03-4ebf-9b5e-adb2b44a61a4';