
-- Tabela de datas bloqueadas
CREATE TABLE public.datas_bloqueadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  motivo text NOT NULL,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_datas_bloqueadas_data ON public.datas_bloqueadas(data);

ALTER TABLE public.datas_bloqueadas ENABLE ROW LEVEL SECURITY;

-- Leitura pública (anon + autenticados) — fluxo de cotação pública precisa consultar
CREATE POLICY "Public read datas bloqueadas"
  ON public.datas_bloqueadas FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita: somente coordenador, diretor, admin_master, desenvolvedor
CREATE POLICY "Coord manage datas bloqueadas insert"
  ON public.datas_bloqueadas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

CREATE POLICY "Coord manage datas bloqueadas update"
  ON public.datas_bloqueadas FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

CREATE POLICY "Coord manage datas bloqueadas delete"
  ON public.datas_bloqueadas FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'admin_master'::app_role)
    OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  );

-- Trigger de updated_at
CREATE TRIGGER trg_datas_bloqueadas_updated_at
  BEFORE UPDATE ON public.datas_bloqueadas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function
CREATE OR REPLACE FUNCTION public.data_esta_bloqueada(_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.datas_bloqueadas WHERE data = _data);
$$;

-- Trigger function para bloquear agendamentos em datas bloqueadas
CREATE OR REPLACE FUNCTION public.bloquear_agendamento_em_data_bloqueada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data date;
  v_old_data date;
  v_motivo text;
BEGIN
  -- Descobre coluna de data conforme a tabela
  IF TG_TABLE_NAME = 'servicos' THEN
    v_data := NEW.data_agendada::date;
    v_old_data := CASE WHEN TG_OP = 'UPDATE' THEN OLD.data_agendada::date ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'vistorias' THEN
    v_data := NEW.data_agendada::date;
    v_old_data := CASE WHEN TG_OP = 'UPDATE' THEN OLD.data_agendada::date ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'agendamentos_base' THEN
    v_data := NEW.data_agendada::date;
    v_old_data := CASE WHEN TG_OP = 'UPDATE' THEN OLD.data_agendada::date ELSE NULL END;
  ELSE
    RETURN NEW;
  END IF;

  IF v_data IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só valida quando é INSERT ou a data mudou no UPDATE
  IF TG_OP = 'INSERT' OR v_data IS DISTINCT FROM v_old_data THEN
    SELECT motivo INTO v_motivo FROM public.datas_bloqueadas WHERE data = v_data;
    IF FOUND THEN
      RAISE EXCEPTION 'DATA_BLOQUEADA: A data % está bloqueada para novos agendamentos. Motivo: %', v_data, v_motivo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Aplica trigger nas três tabelas de agendamento
CREATE TRIGGER trg_bloqueio_data_servicos
  BEFORE INSERT OR UPDATE ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_agendamento_em_data_bloqueada();

CREATE TRIGGER trg_bloqueio_data_vistorias
  BEFORE INSERT OR UPDATE ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_agendamento_em_data_bloqueada();

CREATE TRIGGER trg_bloqueio_data_agendamentos_base
  BEFORE INSERT OR UPDATE ON public.agendamentos_base
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_agendamento_em_data_bloqueada();
