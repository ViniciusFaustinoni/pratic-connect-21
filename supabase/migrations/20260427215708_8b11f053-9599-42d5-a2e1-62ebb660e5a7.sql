-- ============================================================
-- 1) Limpa o agendamento_base órfão de LTS3A98 (cotação f1eef9ed-...)
-- ============================================================
DELETE FROM public.agendamentos_base
WHERE id = '6213aebd-77c5-4ad2-8ad1-aca0e7d6d139'
  AND status = 'nao_compareceu'
  AND data_agendada = '2026-04-29'
  AND cotacao_id = 'f1eef9ed-4f1a-47ac-8aba-13fb037e3c85';

-- ============================================================
-- 2) Trigger de dedupe: ao criar um novo agendamento_base para
--    uma cotação/instalação/vistoria que já tem outro registro
--    NÃO-terminal, fecha o antigo como 'cancelado' automaticamente.
--
--    Status terminais (não tocados): 'concluida', 'concluido',
--    'cancelado', 'cancelada', 'nao_compareceu' (este é tratado
--    como sinal de que o registro precisa ser substituído pelo
--    novo agendamento que está entrando).
-- ============================================================
CREATE OR REPLACE FUNCTION public.dedupe_agendamentos_base_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fecha agendamentos antigos da mesma origem (cotação/instalação/vistoria)
  -- que estejam em qualquer status não-finalizado positivamente.
  UPDATE public.agendamentos_base
  SET status = 'cancelado',
      observacoes = COALESCE(observacoes, '') ||
        E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') ||
        '] Cancelado automaticamente: novo agendamento criado (id ' || NEW.id::text || ').',
      updated_at = now()
  WHERE id <> NEW.id
    AND status NOT IN ('concluida', 'concluido', 'cancelado', 'cancelada')
    AND (
      (NEW.cotacao_id    IS NOT NULL AND cotacao_id    = NEW.cotacao_id)
      OR (NEW.instalacao_id IS NOT NULL AND instalacao_id = NEW.instalacao_id)
      OR (NEW.vistoria_id   IS NOT NULL AND vistoria_id   = NEW.vistoria_id)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dedupe_agendamentos_base_on_insert ON public.agendamentos_base;

CREATE TRIGGER trg_dedupe_agendamentos_base_on_insert
AFTER INSERT ON public.agendamentos_base
FOR EACH ROW
EXECUTE FUNCTION public.dedupe_agendamentos_base_on_insert();