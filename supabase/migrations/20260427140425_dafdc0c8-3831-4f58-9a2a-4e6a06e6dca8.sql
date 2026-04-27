-- =========================================================
-- Múltiplos supervisores por vendedor + split de comissão
-- =========================================================

-- 1) Tabela N:N de supervisores por hierarquia
CREATE TABLE IF NOT EXISTS public.hierarquia_vendas_supervisores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarquia_id UUID NOT NULL REFERENCES public.hierarquia_vendas(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL,
  percentual_personalizado NUMERIC(5,2) NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL,
  CONSTRAINT uq_hierarquia_supervisor UNIQUE (hierarquia_id, supervisor_id),
  CONSTRAINT chk_percentual_personalizado CHECK (
    percentual_personalizado IS NULL
    OR (percentual_personalizado >= 0 AND percentual_personalizado <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_hvs_hierarquia ON public.hierarquia_vendas_supervisores(hierarquia_id);
CREATE INDEX IF NOT EXISTS idx_hvs_supervisor ON public.hierarquia_vendas_supervisores(supervisor_id);

ALTER TABLE public.hierarquia_vendas_supervisores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diretoria/Gerencia gerenciam supervisores" ON public.hierarquia_vendas_supervisores;
CREATE POLICY "Diretoria/Gerencia gerenciam supervisores"
ON public.hierarquia_vendas_supervisores FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Usuario ve supervisores da sua cadeia" ON public.hierarquia_vendas_supervisores;
CREATE POLICY "Usuario ve supervisores da sua cadeia"
ON public.hierarquia_vendas_supervisores FOR SELECT TO authenticated
USING (
  supervisor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.hierarquia_vendas h
    WHERE h.id = hierarquia_vendas_supervisores.hierarquia_id
      AND (h.vendedor_id = auth.uid() OR h.gerente_id = auth.uid() OR h.agencia_id = auth.uid())
  )
);

-- 2) Migrar supervisores singulares existentes
INSERT INTO public.hierarquia_vendas_supervisores (hierarquia_id, supervisor_id, ordem)
SELECT h.id, h.supervisor_id, 0
FROM public.hierarquia_vendas h
WHERE h.supervisor_id IS NOT NULL
ON CONFLICT (hierarquia_id, supervisor_id) DO NOTHING;

-- 3) Coluna na parcela: modo de divisão entre supervisores
ALTER TABLE public.grades_comissao_parcelas
  ADD COLUMN IF NOT EXISTS supervisor_split_mode TEXT NOT NULL DEFAULT 'igual';

ALTER TABLE public.grades_comissao_parcelas
  DROP CONSTRAINT IF EXISTS chk_supervisor_split_mode;
ALTER TABLE public.grades_comissao_parcelas
  ADD CONSTRAINT chk_supervisor_split_mode
  CHECK (supervisor_split_mode IN ('igual','personalizado'));

-- 4) RPC fn_upsert_hierarquia_vendedor estendida com p_supervisores jsonb
--    Mantém a assinatura antiga (com p_supervisor_id) para retrocompatibilidade.
CREATE OR REPLACE FUNCTION public.fn_upsert_hierarquia_vendedor(
  p_vendedor_id UUID,
  p_supervisor_id UUID DEFAULT NULL,
  p_gerente_id UUID DEFAULT NULL,
  p_agencia_id UUID DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_supervisores JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_atual RECORD;
  v_novo_id UUID;
  v_primeiro_supervisor UUID;
  v_supervisores JSONB;
  v_item JSONB;
  v_idx INT := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar hierarquia';
  END IF;

  -- Normaliza array de supervisores: prioridade ao p_supervisores; fallback ao singular
  IF p_supervisores IS NOT NULL AND jsonb_typeof(p_supervisores) = 'array' AND jsonb_array_length(p_supervisores) > 0 THEN
    v_supervisores := p_supervisores;
  ELSIF p_supervisor_id IS NOT NULL THEN
    v_supervisores := jsonb_build_array(jsonb_build_object('supervisor_id', p_supervisor_id));
  ELSE
    v_supervisores := '[]'::jsonb;
  END IF;

  -- Primeiro supervisor (vai para coluna singular de retrocompat)
  IF jsonb_array_length(v_supervisores) > 0 THEN
    v_primeiro_supervisor := (v_supervisores->0->>'supervisor_id')::uuid;
  END IF;

  SELECT * INTO v_atual
  FROM public.hierarquia_vendas
  WHERE vendedor_id = p_vendedor_id AND vigente_ate IS NULL
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.hierarquia_vendas
    SET vigente_ate = now(), updated_at = now()
    WHERE id = v_atual.id;
  END IF;

  INSERT INTO public.hierarquia_vendas(
    vendedor_id, supervisor_id, gerente_id, agencia_id, observacoes, created_by
  ) VALUES (
    p_vendedor_id, v_primeiro_supervisor, p_gerente_id, p_agencia_id, p_observacoes, auth.uid()
  )
  RETURNING id INTO v_novo_id;

  -- Insere todos os supervisores na tabela N:N
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_supervisores)
  LOOP
    INSERT INTO public.hierarquia_vendas_supervisores(
      hierarquia_id, supervisor_id, percentual_personalizado, ordem, created_by
    ) VALUES (
      v_novo_id,
      (v_item->>'supervisor_id')::uuid,
      NULLIF(v_item->>'percentual_personalizado','')::numeric,
      v_idx,
      auth.uid()
    )
    ON CONFLICT (hierarquia_id, supervisor_id) DO NOTHING;
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_novo_id;
END;
$$;

-- 5) Função utilitária para listar supervisores de um vendedor numa data
CREATE OR REPLACE FUNCTION public.fn_listar_supervisores_vendedor(
  p_vendedor_id UUID,
  p_data_referencia TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE(
  supervisor_id UUID,
  percentual_personalizado NUMERIC,
  ordem INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.supervisor_id, s.percentual_personalizado, s.ordem
  FROM public.hierarquia_vendas h
  JOIN public.hierarquia_vendas_supervisores s ON s.hierarquia_id = h.id
  WHERE h.vendedor_id = p_vendedor_id
    AND h.vigente_desde <= p_data_referencia
    AND (h.vigente_ate IS NULL OR h.vigente_ate > p_data_referencia)
  ORDER BY s.ordem, s.created_at;
$$;