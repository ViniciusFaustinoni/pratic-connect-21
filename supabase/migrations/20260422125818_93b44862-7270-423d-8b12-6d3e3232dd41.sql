-- Remove TODOS os jobs 'mapear_codigo' marcados como sem_historico_hinova,
-- pois foram falsos negativos causados pelo header de autorização incorreto
-- no _shared/hinova-client.ts (Authorization usava token de aplicação ao invés
-- de tokenUsuario). Após a correção, os 9.618 veículos podem ser remapeados.
DELETE FROM sga_sync_financeiro_jobs
WHERE tipo = 'mapear_codigo'
  AND status = 'sem_historico_hinova';