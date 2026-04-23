-- 1. Tabela de histórico
CREATE TABLE public.rastreadores_vinculo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID NOT NULL REFERENCES public.rastreadores(id) ON DELETE CASCADE,
  veiculo_id_anterior UUID,
  veiculo_id_novo UUID,
  status_anterior TEXT,
  status_novo TEXT,
  placa_anterior TEXT,
  placa_nova TEXT,
  alterado_por UUID,
  alterado_por_nome TEXT,
  origem TEXT,
  contexto JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rast_vinc_hist_rastreador ON public.rastreadores_vinculo_historico(rastreador_id, created_at DESC);
CREATE INDEX idx_rast_vinc_hist_veiculo_ant ON public.rastreadores_vinculo_historico(veiculo_id_anterior);
CREATE INDEX idx_rast_vinc_hist_veiculo_novo ON public.rastreadores_vinculo_historico(veiculo_id_novo);

-- 2. RLS
ALTER TABLE public.rastreadores_vinculo_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Monitoramento e admin podem ver histórico de vínculo"
ON public.rastreadores_vinculo_historico
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR public.has_role(auth.uid(), 'analista_monitoramento'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
);

-- 3. RPC auxiliar para edge functions setarem a origem
CREATE OR REPLACE FUNCTION public.set_audit_origem(origem text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT set_config('app.audit_origem', origem, true);
$$;

-- 4. Função de trigger
CREATE OR REPLACE FUNCTION public.log_rastreador_vinculo_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_placa_ant text;
  v_placa_nova text;
  v_origem text;
BEGIN
  IF (OLD.veiculo_id IS NOT DISTINCT FROM NEW.veiculo_id)
     AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT nome INTO v_nome FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  IF OLD.veiculo_id IS NOT NULL THEN
    SELECT placa INTO v_placa_ant FROM public.veiculos WHERE id = OLD.veiculo_id;
  END IF;
  IF NEW.veiculo_id IS NOT NULL THEN
    SELECT placa INTO v_placa_nova FROM public.veiculos WHERE id = NEW.veiculo_id;
  END IF;

  BEGIN
    v_origem := current_setting('app.audit_origem', true);
  EXCEPTION WHEN OTHERS THEN
    v_origem := NULL;
  END;

  INSERT INTO public.rastreadores_vinculo_historico (
    rastreador_id, veiculo_id_anterior, veiculo_id_novo,
    status_anterior, status_novo, placa_anterior, placa_nova,
    alterado_por, alterado_por_nome, origem
  ) VALUES (
    NEW.id, OLD.veiculo_id, NEW.veiculo_id,
    OLD.status::text, NEW.status::text, v_placa_ant, v_placa_nova,
    v_uid, COALESCE(v_nome, 'Sistema'),
    COALESCE(NULLIF(v_origem, ''), 'trigger_db')
  );

  RETURN NEW;
END;
$$;

-- 5. Trigger em rastreadores
DROP TRIGGER IF EXISTS trg_rastreador_vinculo_audit ON public.rastreadores;
CREATE TRIGGER trg_rastreador_vinculo_audit
AFTER UPDATE OF veiculo_id, status ON public.rastreadores
FOR EACH ROW
EXECUTE FUNCTION public.log_rastreador_vinculo_change();