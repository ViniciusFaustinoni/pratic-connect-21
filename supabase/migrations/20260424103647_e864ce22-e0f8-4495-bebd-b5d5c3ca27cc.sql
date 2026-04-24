ALTER TABLE public.cc_vendedor_lancamentos
  ADD COLUMN IF NOT EXISTS comissao_id uuid NULL REFERENCES public.comissoes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_vendedor_lancamentos_comissao_id
  ON public.cc_vendedor_lancamentos(comissao_id)
  WHERE comissao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_vendedor_lancamentos_comissao_id
  ON public.cc_vendedor_lancamentos(comissao_id);

CREATE OR REPLACE FUNCTION public.fn_comissoes_usuarios_visiveis(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_user_roles AS (
    SELECT role::text AS role
    FROM public.user_roles
    WHERE user_roles.user_id = p_user_id
  ), scoped AS (
    SELECT p_user_id AS visible_id
    UNION
    SELECT p.id
    FROM public.profiles p
    WHERE EXISTS (
      SELECT 1 FROM current_user_roles r
      WHERE r.role IN ('diretor', 'admin_master', 'desenvolvedor')
    )
    UNION
    SELECT h.vendedor_id
    FROM public.hierarquia_vendas h
    WHERE h.vigente_ate IS NULL
      AND h.gerente_id = p_user_id
      AND EXISTS (SELECT 1 FROM current_user_roles r WHERE r.role = 'gerente_comercial')
    UNION
    SELECT h.vendedor_id
    FROM public.hierarquia_vendas h
    WHERE h.vigente_ate IS NULL
      AND h.supervisor_id = p_user_id
      AND EXISTS (SELECT 1 FROM current_user_roles r WHERE r.role = 'supervisor_vendas')
    UNION
    SELECT h.vendedor_id
    FROM public.hierarquia_vendas h
    WHERE h.vigente_ate IS NULL
      AND h.agencia_id = p_user_id
      AND EXISTS (SELECT 1 FROM current_user_roles r WHERE r.role = 'agencia')
  )
  SELECT DISTINCT visible_id
  FROM scoped
  WHERE visible_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.fn_comissoes_usuarios_visiveis(uuid) TO authenticated;

DROP POLICY IF EXISTS "cc_vendedor_own_select" ON public.cc_vendedor_lancamentos;
DROP POLICY IF EXISTS "cc_admin_all" ON public.cc_vendedor_lancamentos;
DROP POLICY IF EXISTS "cc_hierarquia_select" ON public.cc_vendedor_lancamentos;
DROP POLICY IF EXISTS "cc_diretoria_manage" ON public.cc_vendedor_lancamentos;

CREATE POLICY "cc_hierarquia_select"
ON public.cc_vendedor_lancamentos
FOR SELECT TO authenticated
USING (
  vendedor_id IN (SELECT user_id FROM public.fn_comissoes_usuarios_visiveis(auth.uid()))
);

CREATE POLICY "cc_diretoria_manage"
ON public.cc_vendedor_lancamentos
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor')
  OR public.has_role(auth.uid(), 'admin_master')
  OR public.has_role(auth.uid(), 'desenvolvedor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor')
  OR public.has_role(auth.uid(), 'admin_master')
  OR public.has_role(auth.uid(), 'desenvolvedor')
);

DROP POLICY IF EXISTS "Vendedores podem ver próprias comissões" ON public.comissoes;
CREATE POLICY "Comissoes visiveis por hierarquia"
ON public.comissoes
FOR SELECT TO authenticated
USING (
  vendedor_id IN (SELECT user_id FROM public.fn_comissoes_usuarios_visiveis(auth.uid()))
);

DROP POLICY IF EXISTS "Usuários podem ver pagamentos de comissões" ON public.comissoes_pagamentos;
CREATE POLICY "Pagamentos de comissoes visiveis por hierarquia"
ON public.comissoes_pagamentos
FOR SELECT TO authenticated
USING (
  vendedor_id IN (SELECT user_id FROM public.fn_comissoes_usuarios_visiveis(auth.uid()))
);

DROP POLICY IF EXISTS "Usuários podem ver itens de pagamentos de comissões" ON public.comissoes_pagamento_itens;
CREATE POLICY "Itens de pagamentos visiveis por hierarquia"
ON public.comissoes_pagamento_itens
FOR SELECT TO authenticated
USING (
  vendedor_id IN (SELECT user_id FROM public.fn_comissoes_usuarios_visiveis(auth.uid()))
);

CREATE OR REPLACE FUNCTION public.fn_recalcular_cc_saldos(p_vendedor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_saldo numeric := 0;
BEGIN
  FOR v_row IN
    SELECT id, tipo, valor_liquido
    FROM public.cc_vendedor_lancamentos
    WHERE vendedor_id = p_vendedor_id
      AND status <> 'cancelado'
    ORDER BY data_lancamento ASC, created_at ASC, id ASC
  LOOP
    IF v_row.tipo = 'credito' THEN
      v_saldo := v_saldo + COALESCE(v_row.valor_liquido, 0);
    ELSE
      v_saldo := v_saldo - COALESCE(v_row.valor_liquido, 0);
    END IF;

    UPDATE public.cc_vendedor_lancamentos
    SET saldo_apos = v_saldo,
        updated_at = now()
    WHERE id = v_row.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_recalcular_cc_saldos(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_marcar_comissao_paga(p_comissao_id uuid)
RETURNS TABLE (pagamento_id uuid, comissao_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comissao public.comissoes%rowtype;
  v_pagamento_id uuid;
  v_valor numeric;
  v_descricao text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'admin_master')
    OR public.has_role(auth.uid(), 'desenvolvedor')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar pagamento de comissão';
  END IF;

  SELECT * INTO v_comissao
  FROM public.comissoes
  WHERE id = p_comissao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comissão não encontrada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.comissoes_pagamento_itens cpi WHERE cpi.comissao_id = p_comissao_id) THEN
    RAISE EXCEPTION 'Esta comissão já possui lançamento de pagamento';
  END IF;

  IF v_comissao.status = 'paga' THEN
    RAISE EXCEPTION 'Esta comissão já está marcada como paga';
  END IF;

  v_valor := COALESCE(v_comissao.valor_total, v_comissao.valor_comissao, 0);

  INSERT INTO public.comissoes_pagamentos (
    vendedor_id,
    mes_referencia,
    ano_referencia,
    valor_total,
    quantidade_comissoes,
    data_pagamento,
    observacoes
  ) VALUES (
    v_comissao.vendedor_id,
    v_comissao.mes_referencia,
    v_comissao.ano_referencia,
    v_valor,
    1,
    CURRENT_DATE,
    'Pagamento individual da comissão ' || v_comissao.id::text
  ) RETURNING id INTO v_pagamento_id;

  INSERT INTO public.comissoes_pagamento_itens (
    pagamento_id,
    comissao_id,
    vendedor_id,
    valor_pago,
    status_anterior
  ) VALUES (
    v_pagamento_id,
    v_comissao.id,
    v_comissao.vendedor_id,
    v_valor,
    v_comissao.status
  );

  UPDATE public.comissoes
  SET status = 'paga',
      pago_em = now(),
      updated_at = now()
  WHERE id = v_comissao.id;

  v_descricao := 'Crédito comissão paga';
  IF v_comissao.tipo_comissao IS NOT NULL THEN
    v_descricao := v_descricao || ' — ' || v_comissao.tipo_comissao;
  END IF;
  IF v_comissao.parcela_numero IS NOT NULL THEN
    v_descricao := v_descricao || ' — parcela ' || v_comissao.parcela_numero::text;
  END IF;

  INSERT INTO public.cc_vendedor_lancamentos (
    vendedor_id,
    associado_id,
    contrato_id,
    comissao_id,
    tipo,
    categoria,
    descricao,
    valor_bruto,
    valor_abatimento,
    valor_liquido,
    parcela_numero,
    parcela_total,
    status,
    data_lancamento,
    data_pagamento,
    observacao_pagamento,
    pago_por
  ) VALUES (
    v_comissao.vendedor_id,
    v_comissao.associado_id,
    v_comissao.contrato_id,
    v_comissao.id,
    'credito',
    COALESCE(v_comissao.tipo_comissao, 'comissao'),
    v_descricao,
    v_valor,
    0,
    v_valor,
    v_comissao.parcela_numero,
    v_comissao.parcela_total,
    'pago',
    CURRENT_DATE,
    CURRENT_DATE,
    'Gerado automaticamente ao marcar comissão como paga',
    auth.uid()
  ) ON CONFLICT (comissao_id) WHERE comissao_id IS NOT NULL DO NOTHING;

  PERFORM public.fn_recalcular_cc_saldos(v_comissao.vendedor_id);

  pagamento_id := v_pagamento_id;
  comissao_id := v_comissao.id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_marcar_comissao_paga(uuid) TO authenticated;