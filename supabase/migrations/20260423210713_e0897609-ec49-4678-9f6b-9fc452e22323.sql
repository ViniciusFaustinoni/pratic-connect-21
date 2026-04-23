ALTER TABLE public.logs_auditoria
DROP CONSTRAINT IF EXISTS logs_auditoria_acao_check;

ALTER TABLE public.logs_auditoria
ADD CONSTRAINT logs_auditoria_acao_check CHECK (acao IN (
  'login', 'logout', 'criar', 'editar', 'excluir',
  'visualizar', 'exportar', 'aprovar', 'rejeitar', 'reprovar',
  'alterar_senha', 'alterar_permissao', 'configuracao',
  'atribuir', 'ativar', 'desativar', 'reativar', 'cancelar',
  'enviar', 'duplicar', 'importar', 'baixar'
));

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_modulo ON public.logs_auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_tabela ON public.logs_auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_registro_id ON public.logs_auditoria(registro_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created_at ON public.logs_auditoria(created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_auditoria_profile_snapshot(p_profile_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_profile_id IS NULL THEN NULL::jsonb
    ELSE COALESCE(
      (
        SELECT jsonb_build_object(
          'id', p.id,
          'nome', p.nome,
          'email', p.email
        )
        FROM public.profiles p
        WHERE p.id = p_profile_id
        LIMIT 1
      ),
      jsonb_build_object('id', p_profile_id)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_usuario_atual()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'nome', p.nome,
        'email', p.email
      )
      FROM public.profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
      LIMIT 1
    ),
    jsonb_build_object('id', auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_upsert_hierarquia_vendedor(
  p_vendedor_id UUID,
  p_supervisor_id UUID DEFAULT NULL,
  p_gerente_id UUID DEFAULT NULL,
  p_agencia_id UUID DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual RECORD;
  v_novo_id UUID;
  v_executor JSONB;
  v_usuario_id UUID;
  v_usuario_nome TEXT;
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
     AND COALESCE(v_atual.observacoes,'') = COALESCE(p_observacoes,'')
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

  v_executor := public.fn_auditoria_usuario_atual();
  v_usuario_id := COALESCE((v_executor->>'id')::uuid, auth.uid());
  v_usuario_nome := COALESCE(v_executor->>'nome', v_executor->>'email', auth.uid()::text);

  INSERT INTO public.logs_auditoria(
    usuario_id, usuario_nome, acao, modulo, tabela, registro_id, descricao, dados_anteriores, dados_novos
  ) VALUES (
    v_usuario_id,
    v_usuario_nome,
    'editar',
    'comissoes',
    'hierarquia_vendas',
    v_novo_id,
    'Hierarquia de comissão alterada',
    CASE WHEN FOUND THEN jsonb_build_object(
      'hierarquia_id', v_atual.id,
      'vendedor', public.fn_auditoria_profile_snapshot(v_atual.vendedor_id),
      'supervisor', public.fn_auditoria_profile_snapshot(v_atual.supervisor_id),
      'gerente', public.fn_auditoria_profile_snapshot(v_atual.gerente_id),
      'agencia', public.fn_auditoria_profile_snapshot(v_atual.agencia_id),
      'observacoes', v_atual.observacoes,
      'vigente_desde', v_atual.vigente_desde,
      'vigente_ate', now()
    ) ELSE NULL END,
    jsonb_build_object(
      'hierarquia_id', v_novo_id,
      'vendedor', public.fn_auditoria_profile_snapshot(p_vendedor_id),
      'supervisor', public.fn_auditoria_profile_snapshot(p_supervisor_id),
      'gerente', public.fn_auditoria_profile_snapshot(p_gerente_id),
      'agencia', public.fn_auditoria_profile_snapshot(p_agencia_id),
      'observacoes', p_observacoes,
      'vigente_desde', now(),
      'alterado_por', v_executor
    )
  );

  RETURN v_novo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_atribuir_grade_usuario(
  p_user_id UUID,
  p_grade_id UUID,
  p_papel_no_nivel TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual RECORD;
  v_novo_id UUID;
  v_executor JSONB;
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_data_inicio TIMESTAMPTZ := now();
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'diretor'::app_role)
    OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir grades';
  END IF;

  SELECT ugc.*, gc.nome AS grade_nome, gc.versao AS grade_versao
  INTO v_atual
  FROM public.usuario_grade_comissao ugc
  LEFT JOIN public.grades_comissao gc ON gc.id = ugc.grade_id
  WHERE ugc.user_id = p_user_id AND ugc.data_fim IS NULL
  LIMIT 1;

  IF FOUND
     AND v_atual.grade_id = p_grade_id
     AND COALESCE(v_atual.papel_no_nivel, '') = COALESCE(p_papel_no_nivel, '')
  THEN
    RETURN v_atual.id;
  END IF;

  UPDATE public.usuario_grade_comissao
  SET data_fim = v_data_inicio
  WHERE user_id = p_user_id AND data_fim IS NULL;

  INSERT INTO public.usuario_grade_comissao(user_id, grade_id, atribuido_por, data_inicio, papel_no_nivel)
  VALUES (p_user_id, p_grade_id, auth.uid(), v_data_inicio, p_papel_no_nivel)
  RETURNING id INTO v_novo_id;

  v_executor := public.fn_auditoria_usuario_atual();
  v_usuario_id := COALESCE((v_executor->>'id')::uuid, auth.uid());
  v_usuario_nome := COALESCE(v_executor->>'nome', v_executor->>'email', auth.uid()::text);

  INSERT INTO public.logs_auditoria(
    usuario_id, usuario_nome, acao, modulo, tabela, registro_id, descricao, dados_anteriores, dados_novos
  ) VALUES (
    v_usuario_id,
    v_usuario_nome,
    'atribuir',
    'comissoes',
    'usuario_grade_comissao',
    v_novo_id,
    'Grade atribuída ao usuário/vendedor',
    CASE WHEN FOUND THEN jsonb_build_object(
      'atribuicao_id', v_atual.id,
      'usuario_afetado', public.fn_auditoria_profile_snapshot(v_atual.user_id),
      'grade', jsonb_build_object('id', v_atual.grade_id, 'nome', v_atual.grade_nome, 'versao', v_atual.grade_versao),
      'papel_no_nivel', v_atual.papel_no_nivel,
      'data_inicio', v_atual.data_inicio,
      'data_fim', v_data_inicio
    ) ELSE NULL END,
    jsonb_build_object(
      'atribuicao_id', v_novo_id,
      'usuario_afetado', public.fn_auditoria_profile_snapshot(p_user_id),
      'grade', (
        SELECT jsonb_build_object('id', gc.id, 'nome', gc.nome, 'versao', gc.versao)
        FROM public.grades_comissao gc
        WHERE gc.id = p_grade_id
        LIMIT 1
      ),
      'papel_no_nivel', p_papel_no_nivel,
      'data_inicio', v_data_inicio,
      'atribuido_por', v_executor
    )
  );

  RETURN v_novo_id;
END;
$$;