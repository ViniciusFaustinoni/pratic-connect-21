-- Reset jobs travados em pendente_retry por causa de 401 falsos
-- (token cacheado invalidado por outras instâncias, não credencial errada)
UPDATE public.sga_sync_financeiro_jobs
SET status = 'pendente',
    proximo_retry_em = NULL,
    ultimo_erro = NULL,
    tentativas = 0
WHERE status = 'pendente_retry'
  AND ultimo_erro LIKE '%[auth]%';

-- Também resetar os jobs com erro de payload de data (vamos corrigir o payload)
UPDATE public.sga_sync_financeiro_jobs
SET status = 'pendente',
    proximo_retry_em = NULL,
    ultimo_erro = NULL,
    tentativas = 0
WHERE status = 'pendente_retry'
  AND ultimo_erro LIKE '%necessario enviar%data%';