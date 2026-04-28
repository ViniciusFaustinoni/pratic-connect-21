
-- =========================================================================
-- FASE 0: Infraestrutura de Segurança do Fluxo de Ativação
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) Advisory lock helper para evitar dupla ativação concorrente
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_lock_ativacao(_associado_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock no escopo da transação atual; libera automaticamente no COMMIT/ROLLBACK
  RETURN pg_try_advisory_xact_lock(hashtextextended('ativacao:' || _associado_id::text, 0));
END;
$$;

COMMENT ON FUNCTION public.fn_lock_ativacao(uuid) IS
'Tenta adquirir trava transacional para impedir ativação concorrente do mesmo associado. Retorna true se obteve a trava, false se outro processo já a detém.';

-- -------------------------------------------------------------------------
-- 2) Tabela de auditoria de transições de status do associado
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ativacao_status_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id  uuid NOT NULL,
  contrato_id   uuid,
  from_status   text,
  to_status     text NOT NULL,
  source        text NOT NULL,                  -- ex: 'edge:ativar-associado', 'webhook:autentique', 'manual:ui'
  actor_id      uuid,                            -- auth.uid() quando aplicável
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ativacao_status_log_associado
  ON public.ativacao_status_log (associado_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ativacao_status_log_to_status
  ON public.ativacao_status_log (to_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ativacao_status_log_source
  ON public.ativacao_status_log (source, created_at DESC);

ALTER TABLE public.ativacao_status_log ENABLE ROW LEVEL SECURITY;

-- Apenas usuários internos podem ler. Reaproveita has_role já existente.
CREATE POLICY "ativacao_status_log_select_internos"
  ON public.ativacao_status_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'monitoramento')
    OR public.has_role(auth.uid(), 'coordenador_monitoramento')
    OR public.has_role(auth.uid(), 'suporte')
    OR public.has_role(auth.uid(), 'gerente')
  );

-- INSERT/UPDATE/DELETE: somente service_role (edge functions)
CREATE POLICY "ativacao_status_log_service_write"
  ON public.ativacao_status_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger para alimentar log automaticamente quando o status do associado mudar
CREATE OR REPLACE FUNCTION public.fn_log_associado_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_source := COALESCE(current_setting('app.ativacao_source', true), 'db:trigger');

    INSERT INTO public.ativacao_status_log (
      associado_id, contrato_id, from_status, to_status, source, actor_id, payload
    )
    VALUES (
      NEW.id,
      NEW.contrato_id,
      OLD.status::text,
      NEW.status::text,
      v_source,
      auth.uid(),
      jsonb_build_object('trigger_op', TG_OP)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_associado_status_change ON public.associados;
CREATE TRIGGER trg_log_associado_status_change
  AFTER UPDATE OF status ON public.associados
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_associado_status_change();

-- -------------------------------------------------------------------------
-- 3) Validador de campos obrigatórios para ativação
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_campos_ativacao(_associado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assoc record;
  v_veic  record;
  v_faltando text[] := ARRAY[]::text[];
BEGIN
  SELECT id, cpf, email, telefone, contrato_id, status
    INTO v_assoc
    FROM public.associados
   WHERE id = _associado_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valido', false,
      'motivo', 'associado_nao_encontrado',
      'campos_faltando', jsonb_build_array('associado')
    );
  END IF;

  IF v_assoc.cpf IS NULL OR length(btrim(v_assoc.cpf)) < 11 THEN
    v_faltando := array_append(v_faltando, 'cpf');
  END IF;
  IF v_assoc.email IS NULL OR length(btrim(v_assoc.email)) = 0 THEN
    v_faltando := array_append(v_faltando, 'email');
  END IF;
  IF v_assoc.telefone IS NULL OR length(btrim(v_assoc.telefone)) < 10 THEN
    v_faltando := array_append(v_faltando, 'telefone');
  END IF;

  -- Veículo: pega o vinculado ao contrato do associado
  SELECT v.id, v.placa, v.chassi, v.renavam
    INTO v_veic
    FROM public.veiculos v
   WHERE v.associado_id = _associado_id
   ORDER BY v.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    v_faltando := array_append(v_faltando, 'veiculo');
  ELSE
    IF v_veic.placa IS NULL OR length(btrim(v_veic.placa)) < 7 THEN
      v_faltando := array_append(v_faltando, 'placa');
    END IF;
    IF v_veic.chassi IS NULL OR length(btrim(v_veic.chassi)) < 17 THEN
      v_faltando := array_append(v_faltando, 'chassi');
    END IF;
    IF v_veic.renavam IS NULL OR length(btrim(v_veic.renavam)) < 9 THEN
      v_faltando := array_append(v_faltando, 'renavam');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valido', (array_length(v_faltando, 1) IS NULL),
    'campos_faltando', to_jsonb(v_faltando)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_validar_campos_ativacao(uuid) IS
'Valida se o associado tem todos os campos obrigatórios para ser ativado. Retorna {valido: bool, campos_faltando: [...]}.';

-- -------------------------------------------------------------------------
-- 4) Fila genérica de retry de integrações
-- -------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.integration_provider AS ENUM ('sga', 'softruck', 'rede');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_queue_status AS ENUM ('pending', 'processing', 'success', 'failed', 'dead_letter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.integration_retry_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration     public.integration_provider NOT NULL,
  operation       text NOT NULL,                       -- ex: 'ativar_associado', 'desativar_dispositivo', 'desvincular_cliente'
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id  text,                                -- ex: associado_id::text para deduplicar
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 5,
  last_error      text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  status          public.integration_queue_status NOT NULL DEFAULT 'pending',
  dead_letter_at  timestamptz,
  succeeded_at    timestamptz,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_retry_queue_pickup
  ON public.integration_retry_queue (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_integration_retry_queue_correlation
  ON public.integration_retry_queue (integration, operation, correlation_id);

CREATE INDEX IF NOT EXISTS idx_integration_retry_queue_dead
  ON public.integration_retry_queue (status, dead_letter_at)
  WHERE status = 'dead_letter';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.fn_touch_integration_retry_queue()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_integration_retry_queue ON public.integration_retry_queue;
CREATE TRIGGER trg_touch_integration_retry_queue
  BEFORE UPDATE ON public.integration_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_integration_retry_queue();

ALTER TABLE public.integration_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_retry_queue_select_internos"
  ON public.integration_retry_queue
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'monitoramento')
    OR public.has_role(auth.uid(), 'coordenador_monitoramento')
    OR public.has_role(auth.uid(), 'suporte')
  );

CREATE POLICY "integration_retry_queue_service_write"
  ON public.integration_retry_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
