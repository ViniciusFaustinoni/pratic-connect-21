-- Remover o trigger problemático que usa pg_net
DROP TRIGGER IF EXISTS trigger_rastreador_ativado ON rastreadores;

-- Remover a função que não é mais necessária
DROP FUNCTION IF EXISTS notify_rastreador_ativado();