CREATE OR REPLACE FUNCTION public.sync_servico_on_vistoria_decisao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_status_servico text;
  v_novo_status_agend   text;
  v_novo_status_inst    text;
  v_instalacao_id       uuid;
  v_cotacao_id          uuid;
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

    v_novo_status_inst := CASE NEW.status::text
                            WHEN 'reprovada' THEN 'cancelada'
                            WHEN 'cancelada' THEN 'cancelada'
                            ELSE 'concluida'
                          END;

    UPDATE public.servicos
       SET status = v_novo_status_servico::status_servico,
           concluida_em = COALESCE(concluida_em, now()),
           updated_at = now()
     WHERE vistoria_origem_id = NEW.id
       AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

    UPDATE public.agendamentos_base
       SET status = v_novo_status_agend,
           updated_at = now()
     WHERE vistoria_id = NEW.id
       AND status NOT IN ('realizado','cancelado');

    v_instalacao_id := NEW.instalacao_id;
    v_cotacao_id    := NEW.cotacao_id;

    IF v_instalacao_id IS NULL THEN
      SELECT ab.instalacao_id
        INTO v_instalacao_id
        FROM public.agendamentos_base ab
       WHERE ab.vistoria_id = NEW.id
         AND ab.instalacao_id IS NOT NULL
       ORDER BY ab.created_at DESC
       LIMIT 1;
    END IF;

    IF v_instalacao_id IS NULL AND v_cotacao_id IS NOT NULL THEN
      SELECT i.id
        INTO v_instalacao_id
        FROM public.instalacoes i
       WHERE i.cotacao_id = v_cotacao_id
       ORDER BY i.created_at DESC
       LIMIT 1;
    END IF;

    IF v_instalacao_id IS NOT NULL THEN
      UPDATE public.instalacoes
         SET status = v_novo_status_inst::status_instalacao,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE id = v_instalacao_id
         AND status::text NOT IN ('concluida','cancelada');

      UPDATE public.servicos
         SET status = v_novo_status_servico::status_servico,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE instalacao_origem_id = v_instalacao_id
         AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

      IF NEW.instalacao_id IS NULL THEN
        UPDATE public.vistorias
           SET instalacao_id = v_instalacao_id
         WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill 2.a: vincular agendamentos_base à instalação via cotação
UPDATE public.agendamentos_base ab
   SET instalacao_id = i.id,
       updated_at    = now()
  FROM public.instalacoes i
 WHERE ab.cotacao_id IS NOT NULL
   AND ab.instalacao_id IS NULL
   AND i.cotacao_id = ab.cotacao_id;

-- Backfill 2.b: vincular vistorias à instalação via agendamentos_base
UPDATE public.vistorias v
   SET instalacao_id = ab.instalacao_id
  FROM public.agendamentos_base ab
 WHERE v.instalacao_id IS NULL
   AND ab.vistoria_id = v.id
   AND ab.instalacao_id IS NOT NULL;

-- Backfill 2.c: encerrar instalações órfãs cuja vistoria já foi decidida
UPDATE public.instalacoes inst
   SET status = (CASE v.status::text
                   WHEN 'reprovada' THEN 'cancelada'
                   WHEN 'cancelada' THEN 'cancelada'
                   ELSE 'concluida'
                 END)::status_instalacao,
       concluida_em = COALESCE(inst.concluida_em, now()),
       updated_at = now()
  FROM public.vistorias v
 WHERE v.instalacao_id = inst.id
   AND v.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
   AND inst.status::text NOT IN ('concluida','cancelada');

-- Backfill 2.d: encerrar serviços de instalação órfãos
UPDATE public.servicos s
   SET status = (CASE v.status::text
                   WHEN 'reprovada' THEN 'cancelada'
                   WHEN 'cancelada' THEN 'cancelada'
                   ELSE 'concluida'
                 END)::status_servico,
       concluida_em = COALESCE(s.concluida_em, now()),
       updated_at = now()
  FROM public.vistorias v
 WHERE s.instalacao_origem_id IS NOT NULL
   AND s.instalacao_origem_id = v.instalacao_id
   AND v.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
   AND s.status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');
