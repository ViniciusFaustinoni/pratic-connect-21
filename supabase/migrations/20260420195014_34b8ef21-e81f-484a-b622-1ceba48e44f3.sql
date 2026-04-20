CREATE OR REPLACE FUNCTION public.fn_instalacao_auto_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas aplica auto-transição em status iniciais (agendada/atribuida)
  -- Nunca regride status já avançado
  IF NEW.status NOT IN ('agendada', 'atribuida', 'aguardando_prestador') THEN
    RETURN NEW;
  END IF;

  -- Prestador externo tem prioridade
  IF NEW.vistoriador_prestador_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.vistoriador_prestador_id IS DISTINCT FROM OLD.vistoriador_prestador_id) THEN
    NEW.status := 'aguardando_prestador';
    RETURN NEW;
  END IF;

  -- Instalador interno atribuído
  IF (NEW.instalador_id IS NOT NULL OR NEW.instalador_responsavel_id IS NOT NULL)
     AND NEW.status = 'agendada' THEN
    NEW.status := 'atribuida';
    RETURN NEW;
  END IF;

  -- Se era atribuida e o instalador foi removido, volta para agendada
  IF NEW.status = 'atribuida'
     AND NEW.instalador_id IS NULL
     AND NEW.instalador_responsavel_id IS NULL
     AND NEW.vistoriador_prestador_id IS NULL THEN
    NEW.status := 'agendada';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instalacao_auto_status ON public.instalacoes;

CREATE TRIGGER trg_instalacao_auto_status
BEFORE INSERT OR UPDATE OF instalador_id, instalador_responsavel_id, vistoriador_prestador_id, status
ON public.instalacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_instalacao_auto_status();

-- Backfill: instalações já atribuídas mas ainda como 'agendada' viram 'atribuida' / 'aguardando_prestador'
UPDATE public.instalacoes
SET status = 'aguardando_prestador'
WHERE status = 'agendada' AND vistoriador_prestador_id IS NOT NULL;

UPDATE public.instalacoes
SET status = 'atribuida'
WHERE status = 'agendada'
  AND vistoriador_prestador_id IS NULL
  AND (instalador_id IS NOT NULL OR instalador_responsavel_id IS NOT NULL);