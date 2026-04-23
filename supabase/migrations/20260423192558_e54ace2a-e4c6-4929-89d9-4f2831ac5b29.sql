-- Fase 2 — Hierarquia + Histórico de Grades

CREATE TABLE IF NOT EXISTS public.hierarquia_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL,
  supervisor_id UUID NULL,
  gerente_id UUID NULL,
  agencia_id UUID NULL,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_ate TIMESTAMPTZ NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_hierarquia_vendedor ON public.hierarquia_vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_hierarquia_supervisor ON public.hierarquia_vendas(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_hierarquia_gerente ON public.hierarquia_vendas(gerente_id);
CREATE INDEX IF NOT EXISTS idx_hierarquia_agencia ON public.hierarquia_vendas(agencia_id);
CREATE INDEX IF NOT EXISTS idx_hierarquia_vigencia ON public.hierarquia_vendas(vigente_desde, vigente_ate);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hierarquia_vendedor_aberta
  ON public.hierarquia_vendas(vendedor_id)
  WHERE vigente_ate IS NULL;

ALTER TABLE public.hierarquia_vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diretoria/Gerencia gerenciam hierarquia" ON public.hierarquia_vendas;
CREATE POLICY "Diretoria/Gerencia gerenciam hierarquia"
ON public.hierarquia_vendas FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Usuario ve sua propria cadeia" ON public.hierarquia_vendas;
CREATE POLICY "Usuario ve sua propria cadeia"
ON public.hierarquia_vendas FOR SELECT TO authenticated
USING (
  vendedor_id = auth.uid()
  OR supervisor_id = auth.uid()
  OR gerente_id = auth.uid()
  OR agencia_id = auth.uid()
);

DROP TRIGGER IF EXISTS trg_hierarquia_updated_at ON public.hierarquia_vendas;
CREATE TRIGGER trg_hierarquia_updated_at
BEFORE UPDATE ON public.hierarquia_vendas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico em usuario_grade_comissao (coluna correta: user_id)
ALTER TABLE public.usuario_grade_comissao
  ADD COLUMN IF NOT EXISTS data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS data_fim TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS papel_no_nivel TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_usuario_grade_vigencia
  ON public.usuario_grade_comissao(user_id, data_inicio, data_fim);

CREATE OR REPLACE FUNCTION public.fn_resolver_cadeia(
  p_vendedor_id UUID,
  p_data_referencia TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
  vendedor_id UUID,
  supervisor_id UUID,
  gerente_id UUID,
  agencia_id UUID
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.vendedor_id, h.supervisor_id, h.gerente_id, h.agencia_id
  FROM public.hierarquia_vendas h
  WHERE h.vendedor_id = p_vendedor_id
    AND h.vigente_desde <= p_data_referencia
    AND (h.vigente_ate IS NULL OR h.vigente_ate > p_data_referencia)
  ORDER BY h.vigente_desde DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_upsert_hierarquia_vendedor(
  p_vendedor_id UUID,
  p_supervisor_id UUID DEFAULT NULL,
  p_gerente_id UUID DEFAULT NULL,
  p_agencia_id UUID DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_atual RECORD;
  v_novo_id UUID;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar hierarquia';
  END IF;

  SELECT * INTO v_atual
  FROM public.hierarquia_vendas
  WHERE vendedor_id = p_vendedor_id AND vigente_ate IS NULL
  LIMIT 1;

  IF FOUND
     AND COALESCE(v_atual.supervisor_id::text,'') = COALESCE(p_supervisor_id::text,'')
     AND COALESCE(v_atual.gerente_id::text,'') = COALESCE(p_gerente_id::text,'')
     AND COALESCE(v_atual.agencia_id::text,'') = COALESCE(p_agencia_id::text,'')
  THEN
    RETURN v_atual.id;
  END IF;

  IF FOUND THEN
    UPDATE public.hierarquia_vendas
    SET vigente_ate = now(), updated_at = now()
    WHERE id = v_atual.id;
  END IF;

  INSERT INTO public.hierarquia_vendas(
    vendedor_id, supervisor_id, gerente_id, agencia_id, observacoes, created_by
  ) VALUES (
    p_vendedor_id, p_supervisor_id, p_gerente_id, p_agencia_id, p_observacoes, auth.uid()
  )
  RETURNING id INTO v_novo_id;

  RETURN v_novo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_atribuir_grade_usuario(
  p_user_id UUID,
  p_grade_id UUID,
  p_papel_no_nivel TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_novo_id UUID;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir grades';
  END IF;

  -- Fecha vigências abertas anteriores
  UPDATE public.usuario_grade_comissao
  SET data_fim = now()
  WHERE user_id = p_user_id AND data_fim IS NULL;

  INSERT INTO public.usuario_grade_comissao(user_id, grade_id, atribuido_por, data_inicio, papel_no_nivel)
  VALUES (p_user_id, p_grade_id, auth.uid(), now(), p_papel_no_nivel)
  RETURNING id INTO v_novo_id;

  RETURN v_novo_id;
END;
$$;