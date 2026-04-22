DELETE FROM sga_sync_financeiro_jobs
WHERE tipo = 'mapear_codigo'
  AND status = 'sem_historico_hinova'
  AND ultimo_erro = 'Placa não encontrada na Hinova (veículo da base nova)'
  AND created_at > NOW() - INTERVAL '30 minutes';