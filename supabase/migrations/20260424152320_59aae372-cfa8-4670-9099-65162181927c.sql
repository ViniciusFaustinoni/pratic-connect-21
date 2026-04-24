CREATE TABLE IF NOT EXISTS public.tecnico_perfil_operacional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_permanente public.app_role NOT NULL,
  role_operacional public.app_role NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID NOT NULL,
  encerrado_por UUID,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  encerrado_em TIMESTAMPTZ,
  CONSTRAINT tecnico_perfil_operacional_roles_tecnicos_chk CHECK (
    role_permanente IN ('instalador_vistoriador'::public.app_role, 'vistoriador_base'::public.app_role)
    AND role_operacional IN ('instalador_vistoriador'::public.app_role, 'vistoriador_base'::public.app_role)
  ),
  CONSTRAINT tecnico_perfil_operacional_roles_diferentes_chk CHECK (role_permanente <> role_operacional),
  CONSTRAINT tecnico_perfil_operacional_encerramento_chk CHECK (
    (ativo = true AND encerrado_em IS NULL)
    OR (ativo = false AND encerrado_em IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS tecnico_perfil_operacional_um_ativo_idx
  ON public.tecnico_perfil_operacional(profissional_id)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS tecnico_perfil_operacional_profissional_idx
  ON public.tecnico_perfil_operacional(profissional_id, ativo);

CREATE TABLE IF NOT EXISTS public.tecnico_perfil_operacional_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alterado_por UUID NOT NULL,
  role_anterior public.app_role NOT NULL,
  role_novo public.app_role NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('ativar_cobertura', 'reverter_cobertura')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tecnico_perfil_operacional_hist_profissional_idx
  ON public.tecnico_perfil_operacional_historico(profissional_id, criado_em DESC);

ALTER TABLE public.tecnico_perfil_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnico_perfil_operacional_historico ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_tecnico_perfil_operacional(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'coordenador_monitoramento'::public.app_role)
    OR public.has_role(_user_id, 'diretor'::public.app_role)
    OR public.has_role(_user_id, 'admin_master'::public.app_role)
    OR public.has_role(_user_id, 'desenvolvedor'::public.app_role)
$$;

DROP POLICY IF EXISTS "Gestores podem ver perfil operacional tecnico" ON public.tecnico_perfil_operacional;
CREATE POLICY "Gestores podem ver perfil operacional tecnico"
ON public.tecnico_perfil_operacional
FOR SELECT
TO authenticated
USING (
  public.can_manage_tecnico_perfil_operacional(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = tecnico_perfil_operacional.profissional_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Gestores podem inserir perfil operacional tecnico" ON public.tecnico_perfil_operacional;
CREATE POLICY "Gestores podem inserir perfil operacional tecnico"
ON public.tecnico_perfil_operacional
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_tecnico_perfil_operacional(auth.uid()));

DROP POLICY IF EXISTS "Gestores podem atualizar perfil operacional tecnico" ON public.tecnico_perfil_operacional;
CREATE POLICY "Gestores podem atualizar perfil operacional tecnico"
ON public.tecnico_perfil_operacional
FOR UPDATE
TO authenticated
USING (public.can_manage_tecnico_perfil_operacional(auth.uid()))
WITH CHECK (public.can_manage_tecnico_perfil_operacional(auth.uid()));

DROP POLICY IF EXISTS "Gestores podem ver historico perfil operacional" ON public.tecnico_perfil_operacional_historico;
CREATE POLICY "Gestores podem ver historico perfil operacional"
ON public.tecnico_perfil_operacional_historico
FOR SELECT
TO authenticated
USING (public.can_manage_tecnico_perfil_operacional(auth.uid()));

DROP POLICY IF EXISTS "Gestores podem inserir historico perfil operacional" ON public.tecnico_perfil_operacional_historico;
CREATE POLICY "Gestores podem inserir historico perfil operacional"
ON public.tecnico_perfil_operacional_historico
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_tecnico_perfil_operacional(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_role_operacional_tecnico(_profissional_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH perfil AS (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.id = _profissional_id
  ), permanente AS (
    SELECT ur.role
    FROM public.user_roles ur
    JOIN perfil p ON p.user_id = ur.user_id
    WHERE ur.role IN ('instalador_vistoriador'::public.app_role, 'vistoriador_base'::public.app_role)
    ORDER BY CASE ur.role
      WHEN 'instalador_vistoriador'::public.app_role THEN 1
      WHEN 'vistoriador_base'::public.app_role THEN 2
      ELSE 3
    END
    LIMIT 1
  )
  SELECT COALESCE(
    (
      SELECT tpo.role_operacional
      FROM public.tecnico_perfil_operacional tpo
      WHERE tpo.profissional_id = _profissional_id
        AND tpo.ativo = true
      LIMIT 1
    ),
    (SELECT role FROM permanente)
  )
$$;

CREATE OR REPLACE FUNCTION public.alternar_perfil_operacional_tecnico(_profissional_id UUID)
RETURNS TABLE (
  profissional_id UUID,
  role_permanente public.app_role,
  role_operacional public.app_role,
  em_cobertura BOOLEAN,
  acao TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profissional public.profiles%ROWTYPE;
  v_role_permanente public.app_role;
  v_role_novo public.app_role;
  v_cobertura public.tecnico_perfil_operacional%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.can_manage_tecnico_perfil_operacional(v_user_id) THEN
    RAISE EXCEPTION 'Sem permissão para alternar perfil operacional';
  END IF;

  SELECT * INTO v_profissional
  FROM public.profiles
  WHERE id = _profissional_id
    AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado ou inativo';
  END IF;

  SELECT ur.role INTO v_role_permanente
  FROM public.user_roles ur
  WHERE ur.user_id = v_profissional.user_id
    AND ur.role IN ('instalador_vistoriador'::public.app_role, 'vistoriador_base'::public.app_role)
  ORDER BY CASE ur.role
    WHEN 'instalador_vistoriador'::public.app_role THEN 1
    WHEN 'vistoriador_base'::public.app_role THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF v_role_permanente IS NULL THEN
    RAISE EXCEPTION 'Profissional não possui perfil técnico alternável';
  END IF;

  SELECT * INTO v_cobertura
  FROM public.tecnico_perfil_operacional tpo
  WHERE tpo.profissional_id = _profissional_id
    AND tpo.ativo = true
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.tecnico_perfil_operacional
    SET ativo = false,
        encerrado_por = v_user_id,
        encerrado_em = now()
    WHERE id = v_cobertura.id;

    INSERT INTO public.tecnico_perfil_operacional_historico (
      profissional_id,
      alterado_por,
      role_anterior,
      role_novo,
      acao
    ) VALUES (
      _profissional_id,
      v_user_id,
      v_cobertura.role_operacional,
      v_cobertura.role_permanente,
      'reverter_cobertura'
    );

    RETURN QUERY SELECT _profissional_id, v_cobertura.role_permanente, v_cobertura.role_permanente, false, 'reverter_cobertura'::text;
    RETURN;
  END IF;

  v_role_novo := CASE v_role_permanente
    WHEN 'instalador_vistoriador'::public.app_role THEN 'vistoriador_base'::public.app_role
    ELSE 'instalador_vistoriador'::public.app_role
  END;

  INSERT INTO public.tecnico_perfil_operacional (
    profissional_id,
    role_permanente,
    role_operacional,
    criado_por
  ) VALUES (
    _profissional_id,
    v_role_permanente,
    v_role_novo,
    v_user_id
  );

  INSERT INTO public.tecnico_perfil_operacional_historico (
    profissional_id,
    alterado_por,
    role_anterior,
    role_novo,
    acao
  ) VALUES (
    _profissional_id,
    v_user_id,
    v_role_permanente,
    v_role_novo,
    'ativar_cobertura'
  );

  RETURN QUERY SELECT _profissional_id, v_role_permanente, v_role_novo, true, 'ativar_cobertura'::text;
END;
$$;