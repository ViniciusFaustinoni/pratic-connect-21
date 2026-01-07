-- Trigger para chamar ativar-associado quando rastreador é ativado
CREATE OR REPLACE FUNCTION notify_rastreador_ativado()
RETURNS TRIGGER AS $$
BEGIN
  -- Só ativa se status mudou para 'instalado'
  IF NEW.status = 'instalado' AND (OLD.status IS DISTINCT FROM 'instalado') THEN
    -- Chamar edge function via pg_net
    PERFORM net.http_post(
      url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/ativar-associado',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('rastreador_id', NEW.id, 'veiculo_id', NEW.veiculo_id)::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_rastreador_ativado ON rastreadores;
CREATE TRIGGER trigger_rastreador_ativado
AFTER UPDATE ON rastreadores
FOR EACH ROW
EXECUTE FUNCTION notify_rastreador_ativado();