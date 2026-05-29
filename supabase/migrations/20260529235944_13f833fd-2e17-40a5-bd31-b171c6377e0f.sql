-- Remove jornada legada /q/:token: drop tabelas vazias cotacoes_publicas*
-- Verificado: cotacoes_publicas tem 0 registros em produção.

DROP TABLE IF EXISTS public.cotacoes_publicas_fotos CASCADE;
DROP TABLE IF EXISTS public.cotacoes_publicas_historico CASCADE;
DROP TABLE IF EXISTS public.cotacoes_publicas CASCADE;