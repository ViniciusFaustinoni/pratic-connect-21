
-- =========================================================================
-- 1) FUNÇÕES AUXILIARES
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_funcionario_interno(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = _user_id
        AND p.tipo = 'funcionario'
        AND p.ativo = true
        AND (p.bloqueado IS NULL OR p.bloqueado = false)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role::text IN ('vendedor_clt','vendedor_externo','agencia')
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text IN (
        'diretor','admin_master','desenvolvedor',
        'gerente_comercial','supervisor_vendas',
        'analista_cadastro','analista_plataforma','analista_marketing',
        'analista_juridico','analista_monitoramento',
        'coordenador_monitoramento','instalador_vistoriador'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_vendedor_nao_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role::text IN ('vendedor_clt','vendedor_externo','agencia')
      AND p.ativo = true
      AND (p.bloqueado IS NULL OR p.bloqueado = false)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role::text IN ('diretor','admin_master','desenvolvedor','gerente_comercial','supervisor_vendas')
  );
$$;

-- IDs de associados visíveis por um vendedor
CREATE OR REPLACE FUNCTION public.get_vendedor_associado_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH pid AS (
    SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
  )
  SELECT DISTINCT a.id
  FROM public.associados a
  WHERE
    a.vendedor_original_id = (SELECT id FROM pid)
    OR a.id IN (
      SELECT ct.associado_id
      FROM public.contratos ct
      WHERE (ct.vendedor_id = (SELECT id FROM pid) OR ct.created_by = (SELECT id FROM pid))
        AND ct.associado_id IS NOT NULL
    );
$$;

-- =========================================================================
-- 2) ASSOCIADOS
-- =========================================================================

DROP POLICY IF EXISTS "Staff can view all associates" ON public.associados;
DROP POLICY IF EXISTS "Staff can manage associates" ON public.associados;

CREATE POLICY "Staff and own scope can view associates"
ON public.associados
FOR SELECT
USING (
  is_funcionario_interno(auth.uid())
  OR user_id = auth.uid()
  OR (
    is_vendedor_nao_gestor(auth.uid())
    AND id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
  )
);

CREATE POLICY "Internal staff can manage associates"
ON public.associados
FOR ALL
USING (is_funcionario_interno(auth.uid()))
WITH CHECK (is_funcionario_interno(auth.uid()));

CREATE POLICY "Vendedor pode inserir associados"
ON public.associados
FOR INSERT
WITH CHECK (is_vendedor_nao_gestor(auth.uid()));

CREATE POLICY "Vendedor pode atualizar seus associados"
ON public.associados
FOR UPDATE
USING (
  is_vendedor_nao_gestor(auth.uid())
  AND id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
)
WITH CHECK (
  is_vendedor_nao_gestor(auth.uid())
  AND id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
);

-- =========================================================================
-- 3) VEÍCULOS
-- =========================================================================

DROP POLICY IF EXISTS "View vehicles" ON public.veiculos;
DROP POLICY IF EXISTS "Staff can manage vehicles" ON public.veiculos;

CREATE POLICY "View vehicles scoped"
ON public.veiculos
FOR SELECT
USING (
  is_funcionario_interno(auth.uid())
  OR associado_id = get_my_associado_id(auth.uid())
  OR (
    is_vendedor_nao_gestor(auth.uid())
    AND associado_id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
  )
);

CREATE POLICY "Internal staff can manage vehicles"
ON public.veiculos
FOR ALL
USING (is_funcionario_interno(auth.uid()))
WITH CHECK (is_funcionario_interno(auth.uid()));

CREATE POLICY "Vendedor pode inserir veiculos dos seus associados"
ON public.veiculos
FOR INSERT
WITH CHECK (
  is_vendedor_nao_gestor(auth.uid())
  AND associado_id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
);

CREATE POLICY "Vendedor pode atualizar veiculos dos seus associados"
ON public.veiculos
FOR UPDATE
USING (
  is_vendedor_nao_gestor(auth.uid())
  AND associado_id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
)
WITH CHECK (
  is_vendedor_nao_gestor(auth.uid())
  AND associado_id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
);

-- =========================================================================
-- 4) CONTRATOS
-- =========================================================================

DROP POLICY IF EXISTS "Staff can view contracts" ON public.contratos;

CREATE POLICY "Staff and own scope can view contracts"
ON public.contratos
FOR SELECT
USING (
  is_funcionario_interno(auth.uid())
  OR vendedor_id = get_current_profile_id()
  OR created_by = get_current_profile_id()
);

-- =========================================================================
-- 5) SERVIÇOS
-- =========================================================================

DROP POLICY IF EXISTS "Funcionarios podem ver servicos" ON public.servicos;
DROP POLICY IF EXISTS "Funcionarios podem gerenciar servicos" ON public.servicos;

CREATE POLICY "Staff and own scope can view servicos"
ON public.servicos
FOR SELECT
USING (
  is_funcionario_interno(auth.uid())
  OR (
    is_vendedor_nao_gestor(auth.uid())
    AND associado_id IN (SELECT public.get_vendedor_associado_ids(auth.uid()))
  )
);

CREATE POLICY "Internal staff can manage servicos"
ON public.servicos
FOR ALL
USING (is_funcionario_interno(auth.uid()))
WITH CHECK (is_funcionario_interno(auth.uid()));
