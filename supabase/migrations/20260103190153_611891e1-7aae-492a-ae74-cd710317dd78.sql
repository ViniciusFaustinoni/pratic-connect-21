-- Habilitar extensão pg_net para fazer chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função que notifica mudança de status do sinistro
CREATE OR REPLACE FUNCTION public.notify_sinistro_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só notifica se o status realmente mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Chamar Edge Function via HTTP
    PERFORM net.http_post(
      url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/notificar-sinistro',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'sinistro_id', NEW.id,
        'status', NEW.status::text,
        'dados_extras', jsonb_build_object(
          'status_anterior', OLD.status::text,
          'protocolo', NEW.protocolo
        )
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela sinistros
DROP TRIGGER IF EXISTS on_sinistro_status_change ON public.sinistros;
CREATE TRIGGER on_sinistro_status_change
  AFTER UPDATE ON public.sinistros
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sinistro_status_change();