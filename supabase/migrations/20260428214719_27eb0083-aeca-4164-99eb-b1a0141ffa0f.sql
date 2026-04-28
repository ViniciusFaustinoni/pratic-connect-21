CREATE TABLE IF NOT EXISTS public.ativacao_limbo_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid REFERENCES public.associados(id) ON DELETE CASCADE,
  instalacao_id uuid REFERENCES public.instalacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberto',
  primeira_deteccao_em timestamptz NOT NULL DEFAULT now(),
  ultima_deteccao_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_limbo_assoc
  ON public.ativacao_limbo_alertas (tipo, associado_id)
  WHERE associado_id IS NOT NULL AND instalacao_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_limbo_inst
  ON public.ativacao_limbo_alertas (tipo, instalacao_id)
  WHERE instalacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_limbo_status ON public.ativacao_limbo_alertas (status, ultima_deteccao_em DESC);

ALTER TABLE public.ativacao_limbo_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diretoria leem alertas limbo" ON public.ativacao_limbo_alertas;
CREATE POLICY "Diretoria leem alertas limbo"
  ON public.ativacao_limbo_alertas FOR SELECT
  USING (public.is_diretor(auth.uid()));

DROP POLICY IF EXISTS "Diretoria atualiza alertas limbo" ON public.ativacao_limbo_alertas;
CREATE POLICY "Diretoria atualiza alertas limbo"
  ON public.ativacao_limbo_alertas FOR UPDATE
  USING (public.is_diretor(auth.uid()))
  WITH CHECK (public.is_diretor(auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_detectar_limbo_ativacao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v1 int := 0; v2 int := 0; v3 int := 0;
BEGIN
  WITH alvos AS (
    SELECT a.id AS associado_id
    FROM public.associados a
    WHERE a.status::text = 'aguardando_instalacao'
      AND a.updated_at < (now() - interval '72 hours')
      AND NOT EXISTS (
        SELECT 1 FROM public.instalacoes i
        WHERE i.associado_id = a.id
          AND i.status::text IN ('agendada','em_rota','em_andamento','em_analise')
      )
  ), ins AS (
    INSERT INTO public.ativacao_limbo_alertas (associado_id, tipo, severidade, detalhes)
    SELECT associado_id, 'aguardando_instalacao_72h', 'media', jsonb_build_object('detectado_em', now())
    FROM alvos
    ON CONFLICT (tipo, associado_id) WHERE associado_id IS NOT NULL AND instalacao_id IS NULL
    DO UPDATE SET ultima_deteccao_em = now(), status = 'aberto', updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v1 FROM ins;

  WITH alvos AS (
    SELECT DISTINCT a.id AS associado_id
    FROM public.associados a
    JOIN public.contratos c ON c.associado_id = a.id
    WHERE a.status::text = 'assinado'
      AND a.updated_at < (now() - interval '1 hour')
      AND c.status::text IN ('assinado','ativo')
  ), ins AS (
    INSERT INTO public.ativacao_limbo_alertas (associado_id, tipo, severidade, detalhes)
    SELECT associado_id, 'assinado_orfao', 'alta', jsonb_build_object('acao_sugerida','reenfileirar ativar-associado')
    FROM alvos
    ON CONFLICT (tipo, associado_id) WHERE associado_id IS NOT NULL AND instalacao_id IS NULL
    DO UPDATE SET ultima_deteccao_em = now(), status = 'aberto', updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v2 FROM ins;

  WITH alvos AS (
    SELECT i.id, i.associado_id
    FROM public.instalacoes i
    WHERE i.status::text = 'em_andamento'
      AND i.updated_at < (now() - interval '24 hours')
  ), ins AS (
    INSERT INTO public.ativacao_limbo_alertas (associado_id, instalacao_id, tipo, severidade, detalhes)
    SELECT associado_id, id, 'instalacao_em_andamento_24h', 'alta', jsonb_build_object('detectado_em', now())
    FROM alvos
    ON CONFLICT (tipo, instalacao_id) WHERE instalacao_id IS NOT NULL
    DO UPDATE SET ultima_deteccao_em = now(), status = 'aberto', updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v3 FROM ins;

  UPDATE public.ativacao_limbo_alertas
     SET status = 'resolvido', resolvido_em = now(), updated_at = now()
   WHERE status = 'aberto'
     AND ultima_deteccao_em < (now() - interval '30 minutes');

  RETURN jsonb_build_object(
    'aguardando_instalacao_72h', v1,
    'assinado_orfao', v2,
    'instalacao_em_andamento_24h', v3,
    'executado_em', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tg_limbo_touch ON public.ativacao_limbo_alertas;
CREATE TRIGGER tg_limbo_touch BEFORE UPDATE ON public.ativacao_limbo_alertas
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DO $$ BEGIN
  PERFORM cron.unschedule('detectar-limbo-ativacao-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'detectar-limbo-ativacao-30min',
  '*/30 * * * *',
  $$ SELECT public.fn_detectar_limbo_ativacao(); $$
);