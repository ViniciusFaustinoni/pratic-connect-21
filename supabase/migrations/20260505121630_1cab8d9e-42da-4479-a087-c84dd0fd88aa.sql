
-- ============================================================
-- AUDITORIA SISTÊMICA: função genérica + triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_auditoria_generica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_user_nome text;
  v_acao text;
  v_modulo text;
  v_registro_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_old_diff jsonb := '{}'::jsonb;
  v_new_diff jsonb := '{}'::jsonb;
  v_descricao text;
  v_status_old text;
  v_status_new text;
  v_key text;
  v_val jsonb;
  v_ignored text[] := ARRAY[
    'updated_at','created_at','search_vector','embedding',
    'tsv','last_seen_at','last_sync_at','last_login_at','version'
  ];
  v_label text := NULL;
BEGIN
  -- Resolve usuário (silencioso se não autenticado)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT id, COALESCE(nome, email)
      INTO v_profile_id, v_user_nome
      FROM public.profiles
     WHERE user_id = v_user_id
     LIMIT 1;
  END IF;

  IF v_user_nome IS NULL THEN
    v_user_nome := 'Sistema';
  END IF;

  -- Snapshots
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;

  -- registro_id
  BEGIN
    v_registro_id := COALESCE(
      (v_new->>'id')::uuid,
      (v_old->>'id')::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_registro_id := NULL;
  END;

  -- Módulo a partir do nome da tabela
  v_modulo := CASE TG_TABLE_NAME
    WHEN 'servicos' THEN 'operacoes'
    WHEN 'agendamentos_base' THEN 'operacoes'
    WHEN 'vistorias' THEN 'vistorias'
    WHEN 'vistoria_fotos' THEN 'vistorias'
    WHEN 'instalacoes' THEN 'instalacoes'
    WHEN 'acionamentos_roubo_furto' THEN 'eventos'
    WHEN 'despacho_reboque' THEN 'eventos'
    WHEN 'chamados_assistencia' THEN 'eventos'
    WHEN 'confirmacoes_agendamento' THEN 'operacoes'
    WHEN 'encaixes_urgentes' THEN 'operacoes'
    WHEN 'ordens_servico' THEN 'operacoes'
    WHEN 'associados' THEN 'associados'
    WHEN 'veiculos' THEN 'veiculos'
    WHEN 'contratos' THEN 'contratos'
    WHEN 'contratos_documentos' THEN 'contratos'
    WHEN 'documento_gerados' THEN 'documentos'
    WHEN 'cotacoes' THEN 'cotacoes'
    WHEN 'hierarquia_vendas' THEN 'comissoes'
    WHEN 'usuario_grade_comissao' THEN 'comissoes'
    WHEN 'grades_comissao' THEN 'comissoes'
    WHEN 'grades_comissao_versoes' THEN 'comissoes'
    WHEN 'comissoes_pagamentos' THEN 'comissoes'
    WHEN 'cc_vendedor_lancamentos' THEN 'comissoes'
    WHEN 'aprovacoes_fipe_diretoria' THEN 'aprovacoes'
    WHEN 'aprovacoes_fipe_menor' THEN 'aprovacoes'
    WHEN 'aprovacoes_elegibilidade' THEN 'aprovacoes'
    WHEN 'chat_solicitacoes_ia' THEN 'aprovacoes'
    WHEN 'profiles' THEN 'usuarios'
    WHEN 'user_roles' THEN 'usuarios'
    WHEN 'app_roles_config' THEN 'usuarios'
    WHEN 'planos' THEN 'planos'
    WHEN 'coberturas' THEN 'planos'
    WHEN 'beneficios' THEN 'planos'
    WHEN 'beneficios_adicionais' THEN 'planos'
    WHEN 'entity_eligibility_rules' THEN 'planos'
    WHEN 'campanhas_desconto' THEN 'marketing'
    WHEN 'cobrancas' THEN 'cobrancas'
    WHEN 'acordos' THEN 'cobrancas'
    WHEN 'caso_juridico_historico' THEN 'juridico'
    ELSE 'sistema'
  END;

  -- Determinar ação
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criar';
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluir';
  ELSE
    v_acao := 'editar';
    v_status_old := COALESCE(v_old->>'status', '');
    v_status_new := COALESCE(v_new->>'status', '');

    IF v_status_old <> v_status_new THEN
      IF v_status_new IN ('ativo','ativa') THEN v_acao := 'ativar';
      ELSIF v_status_new IN ('aprovado','aprovada','aprovada_ressalvas') THEN v_acao := 'aprovar';
      ELSIF v_status_new IN ('reprovado','reprovada','rejeitado','rejeitada') THEN v_acao := 'reprovar';
      ELSIF v_status_new IN ('cancelado','cancelada') THEN v_acao := 'cancelar';
      ELSIF v_status_new IN ('concluida','concluido','finalizado','finalizada') THEN v_acao := 'concluir';
      ELSIF v_status_new IN ('em_andamento','iniciada','iniciado') THEN v_acao := 'iniciar';
      ELSIF v_status_new IN ('suspenso','suspensa','inativo','inativa') THEN v_acao := 'desativar';
      ELSE v_acao := 'editar';
      END IF;
    ELSIF (v_old->>'prestador_id' IS DISTINCT FROM v_new->>'prestador_id'
        OR v_old->>'tecnico_id' IS DISTINCT FROM v_new->>'tecnico_id'
        OR v_old->>'vendedor_id' IS DISTINCT FROM v_new->>'vendedor_id'
        OR v_old->>'responsavel_id' IS DISTINCT FROM v_new->>'responsavel_id') THEN
      v_acao := 'atribuir';
    END IF;
  END IF;

  -- Diff (apenas em UPDATE; INSERT/DELETE guardam snapshot completo enxuto)
  IF TG_OP = 'UPDATE' THEN
    FOR v_key, v_val IN SELECT * FROM jsonb_each(v_new) LOOP
      IF v_key = ANY(v_ignored) THEN CONTINUE; END IF;
      IF v_old->v_key IS DISTINCT FROM v_val THEN
        v_old_diff := v_old_diff || jsonb_build_object(v_key, v_old->v_key);
        v_new_diff := v_new_diff || jsonb_build_object(v_key, v_val);
      END IF;
    END LOOP;

    -- Se nada mudou (apenas timestamps), não loga
    IF v_new_diff = '{}'::jsonb THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_diff := v_new - v_ignored;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_diff := v_old - v_ignored;
  END IF;

  -- Label humano
  v_label := COALESCE(
    v_new->>'placa', v_old->>'placa',
    v_new->>'numero', v_old->>'numero',
    v_new->>'codigo', v_old->>'codigo',
    v_new->>'nome', v_old->>'nome'
  );

  v_descricao := format('%s em %s%s',
    v_acao,
    TG_TABLE_NAME,
    CASE WHEN v_label IS NOT NULL THEN ' (' || v_label || ')' ELSE '' END
  );

  BEGIN
    INSERT INTO public.logs_auditoria (
      usuario_id, usuario_nome, acao, modulo, tabela,
      registro_id, dados_anteriores, dados_novos, descricao
    ) VALUES (
      COALESCE(v_profile_id, v_user_id),
      v_user_nome,
      v_acao,
      v_modulo,
      TG_TABLE_NAME,
      v_registro_id,
      NULLIF(v_old_diff, '{}'::jsonb),
      NULLIF(v_new_diff, '{}'::jsonb),
      v_descricao
    );
  EXCEPTION WHEN OTHERS THEN
    -- Nunca derrubar a operação original
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- Helper: anexa trigger de auditoria se a tabela existir
-- ============================================================
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    -- Operações
    'servicos','agendamentos_base','vistorias','vistoria_fotos','instalacoes',
    'acionamentos_roubo_furto','despacho_reboque','chamados_assistencia',
    'confirmacoes_agendamento','encaixes_urgentes','ordens_servico',
    -- Cadastro
    'associados','veiculos','contratos','contratos_documentos','documento_gerados',
    -- Comercial / comissões
    'cotacoes','hierarquia_vendas','usuario_grade_comissao','grades_comissao',
    'grades_comissao_versoes','comissoes_pagamentos','cc_vendedor_lancamentos',
    -- Aprovações
    'aprovacoes_fipe_diretoria','aprovacoes_fipe_menor','aprovacoes_elegibilidade',
    'chat_solicitacoes_ia',
    -- Acesso
    'profiles','user_roles','app_roles_config',
    -- Produto
    'planos','coberturas','beneficios','beneficios_adicionais',
    'entity_eligibility_rules','campanhas_desconto',
    -- Cobrança / jurídico
    'cobrancas','acordos','caso_juridico_historico'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name=t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria_generica ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_auditoria_generica
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_generica()', t
      );
    END IF;
  END LOOP;
END $$;
