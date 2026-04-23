-- Trigger de sync: ao decidir vistoria, fecha servicos materializados e agendamentos_base vinculados
CREATE OR REPLACE FUNCTION public.sync_servico_on_vistoria_decisao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_status_servico text;
  v_novo_status_agend text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada') THEN

    v_novo_status_servico := CASE NEW.status::text
                               WHEN 'reprovada' THEN 'cancelada'
                               WHEN 'cancelada' THEN 'cancelada'
                               ELSE 'concluida'
                             END;

    v_novo_status_agend := CASE NEW.status::text
                             WHEN 'reprovada' THEN 'cancelado'
                             WHEN 'cancelada' THEN 'cancelado'
                             ELSE 'realizado'
                           END;

    -- Encerra serviços ativos vinculados à vistoria
    UPDATE public.servicos
       SET status = v_novo_status_servico::status_servico,
           concluida_em = COALESCE(concluida_em, now()),
           updated_at = now()
     WHERE vistoria_origem_id = NEW.id
       AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

    -- Encerra agendamentos_base vinculados diretamente à vistoria
    UPDATE public.agendamentos_base
       SET status = v_novo_status_agend,
           updated_at = now()
     WHERE vistoria_id = NEW.id
       AND status NOT IN ('realizado','cancelado');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_servico_on_vistoria_decisao ON public.vistorias;
CREATE TRIGGER trg_sync_servico_on_vistoria_decisao
AFTER UPDATE OF status ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.sync_servico_on_vistoria_decisao();

-- Backfill defensivo: encerra serviços ativos de vistorias já decididas
UPDATE public.servicos s
   SET status = CASE v.status::text
                  WHEN 'reprovada' THEN 'cancelada'::status_servico
                  WHEN 'cancelada' THEN 'cancelada'::status_servico
                  ELSE 'concluida'::status_servico
                END,
       concluida_em = COALESCE(s.concluida_em, now()),
       updated_at = now()
  FROM public.vistorias v
 WHERE s.vistoria_origem_id = v.id
   AND v.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
   AND s.status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

-- Backfill: encerra agendamentos_base vinculados a vistorias já decididas
UPDATE public.agendamentos_base ab
   SET status = CASE v.status::text
                  WHEN 'reprovada' THEN 'cancelado'
                  WHEN 'cancelada' THEN 'cancelado'
                  ELSE 'realizado'
                END,
       updated_at = now()
  FROM public.vistorias v
 WHERE ab.vistoria_id = v.id
   AND v.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
   AND ab.status NOT IN ('realizado','cancelado');