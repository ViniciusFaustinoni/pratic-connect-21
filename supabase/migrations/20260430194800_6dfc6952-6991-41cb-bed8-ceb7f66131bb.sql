-- Trigger: sincronia entre instalacao_prestador_links e servicos.status
CREATE OR REPLACE FUNCTION public.sync_servico_on_prestador_link_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existe_outro_ativo boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Estados terminais não-conclusivos
    IF NEW.status IN ('cancelada','expirado') THEN
      SELECT EXISTS (
        SELECT 1 FROM public.instalacao_prestador_links l
        WHERE l.instalacao_id = NEW.instalacao_id
          AND l.id <> NEW.id
          AND l.status NOT IN ('cancelada','expirado','concluida')
      ) INTO v_existe_outro_ativo;

      IF NOT v_existe_outro_ativo THEN
        UPDATE public.servicos
           SET status = 'pendente', updated_at = now()
         WHERE instalacao_origem_id = NEW.instalacao_id
           AND status = 'agendada'
           AND profissional_id IS NULL;
      END IF;

    ELSIF NEW.status = 'concluida' THEN
      UPDATE public.servicos
         SET status = 'concluida',
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE instalacao_origem_id = NEW.instalacao_id
         AND status NOT IN ('concluida','cancelada');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_servico_on_prestador_link_change ON public.instalacao_prestador_links;
CREATE TRIGGER trg_sync_servico_on_prestador_link_change
AFTER UPDATE ON public.instalacao_prestador_links
FOR EACH ROW
EXECUTE FUNCTION public.sync_servico_on_prestador_link_change();

-- Backfill 2a: serviços com link concluído ainda não fechados
UPDATE public.servicos s
   SET status = 'concluida',
       concluida_em = COALESCE(s.concluida_em, now()),
       updated_at = now()
 WHERE s.instalacao_origem_id IS NOT NULL
   AND s.status IN ('pendente','agendada')
   AND EXISTS (
     SELECT 1 FROM public.instalacao_prestador_links l
      WHERE l.instalacao_id = s.instalacao_origem_id
        AND l.status = 'concluida'
   );

-- Backfill 2b: serviços pendentes com link ativo → agendada
UPDATE public.servicos s
   SET status = 'agendada', updated_at = now()
 WHERE s.instalacao_origem_id IS NOT NULL
   AND s.status = 'pendente'
   AND s.profissional_id IS NULL
   AND EXISTS (
     SELECT 1 FROM public.instalacao_prestador_links l
      WHERE l.instalacao_id = s.instalacao_origem_id
        AND l.status NOT IN ('cancelada','expirado','concluida')
   );

-- Backfill 2c: cancelar links "aguardando" residuais cuja instalação já foi concluída
UPDATE public.instalacao_prestador_links l
   SET status = 'cancelada', updated_at = now()
 WHERE l.status = 'aguardando'
   AND EXISTS (
     SELECT 1 FROM public.instalacao_prestador_links l2
      WHERE l2.instalacao_id = l.instalacao_id
        AND l2.id <> l.id
        AND l2.status = 'concluida'
   );
