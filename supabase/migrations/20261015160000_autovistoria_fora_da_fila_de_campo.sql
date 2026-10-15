-- =============================================================================
-- ERR-VISTH6 (relato 1968, 15/10/2026) — "Status em_rota invalido para servico
-- de autovistoria" ao técnico tocar "Iniciar Tarefa" (QQG4D99).
--
-- Cadeia do incidente (logs_auditoria, servico 227a8e51):
--   15:48:40  Cadastro aprova a autovistoria -> servico aprovada -> cancelada
--             pelo cancelar_vistoria_entrada_orfa_servico (substituída pela
--             instalação 23570e52). Correto.
--   15:48:42  Atribuição de técnico pelo Monitoramento grava
--             {status:'agendada', profissional_id:<técnico>} TAMBÉM no card da
--             autovistoria, ressuscitando-o de 'cancelada'. O guard de
--             reabertura só olha autovistoria quando app.realocacao_monitoramento
--             = 'on', então passou.
--   Tela /instalador: a RPC buscar_tarefa_atual_profissional já escondia o card
--             (instalação irmã agendada), mas voltou vazia e o fallback direto
--             na tabela do front não filtra modalidade -> card de autovistoria
--             vira a "tarefa atual" e iniciar_rota_servico tenta 'em_rota',
--             barrado pelo fn_guard_autovistoria_servico_disjunto (23514).
--
-- Correção (somente leitura/mensagens; a atribuição em si é válida):
--   (3) iniciar_rota_servico / iniciar_tarefa_servico: autovistoria responde
--       ok=false com mensagem clara em vez de 400 de constraint.
--   (4) buscar_tarefa_atual_profissional: autovistoria nunca é tarefa de campo.
--   Caso QQG4D99 liberado manualmente em 15/10: técnico atribuído no card de
--   INSTALAÇÃO INS-2026-01101. Causa raiz da reabertura do card de autovistoria
--   pela atribuição: pendente, a tratar à parte.
-- =============================================================================

-- (3a) iniciar_rota_servico -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.iniciar_rota_servico(p_servico_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_servico record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO',
      'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PROFILE_NAO_ENCONTRADO',
      'mensagem', 'Seu perfil de profissional não foi encontrado.');
  END IF;

  SELECT s.id, s.status::text AS status, s.profissional_id,
         (COALESCE(s.modalidade::text, '') = 'autovistoria'
          OR EXISTS (SELECT 1 FROM public.vistorias v
                      WHERE v.id = s.vistoria_origem_id AND v.modalidade::text = 'autovistoria')) AS is_autovistoria
    INTO v_servico
    FROM public.servicos s
   WHERE s.id = p_servico_id
   FOR UPDATE OF s;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_NAO_ENCONTRADO',
      'mensagem', 'Esta tarefa não existe mais.');
  END IF;

  IF v_servico.is_autovistoria THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AUTOVISTORIA_SEM_CAMPO',
      'mensagem', 'Este card é da AUTO-VISTORIA (feita pelo celular do associado) e não vai a campo. Peça ao Monitoramento para atribuir você no card de INSTALAÇÃO desta placa.');
  END IF;

  IF v_servico.profissional_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_SEM_PROFISSIONAL',
      'mensagem', 'Esta tarefa foi cancelada e não está mais disponível.');
  END IF;

  IF v_servico.profissional_id <> v_profile_id THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'SERVICO_REATRIBUIDO',
      'mensagem', 'Esta tarefa foi reatribuída a outro técnico.');
  END IF;

  IF v_servico.status NOT IN ('agendada','em_rota') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO',
      'mensagem', 'Esta tarefa não pode mais ser iniciada (status atual: ' || v_servico.status || ').');
  END IF;

  IF v_servico.status = 'em_rota' THEN
    RETURN jsonb_build_object('ok', true, 'codigo', 'JA_EM_ROTA',
      'mensagem', 'Rota já estava iniciada.');
  END IF;

  UPDATE public.servicos
     SET status = 'em_rota',
         em_rota_em = now(),
         updated_at = now()
   WHERE id = p_servico_id
     AND profissional_id = v_profile_id
     AND status = 'agendada';

  RETURN jsonb_build_object('ok', true, 'codigo', 'OK',
    'mensagem', 'Rota iniciada.');
END;
$function$;

-- (3b) iniciar_tarefa_servico ---------------------------------------------------
-- Base: definição viva em produção em 15/10/2026 (ver dry-run do ERR-VISTH6).
-- Só acrescenta o desvio de autovistoria antes das demais validações.
DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.iniciar_tarefa_servico(uuid)'::regprocedure) INTO v_def;
  IF position('AUTOVISTORIA_SEM_CAMPO' IN v_def) > 0 THEN
    RETURN; -- já aplicado
  END IF;
  IF position('IF v_servico.profissional_id IS NULL THEN' IN v_def) = 0 THEN
    RAISE NOTICE 'iniciar_tarefa_servico: ponto de inserção não encontrado; mantida sem alteração.';
    RETURN;
  END IF;
  v_def := replace(v_def,
    'IF v_servico.profissional_id IS NULL THEN',
    $ins$IF COALESCE((SELECT s.modalidade::text FROM public.servicos s WHERE s.id = p_servico_id), '') = 'autovistoria'
     OR EXISTS (SELECT 1 FROM public.servicos s JOIN public.vistorias v ON v.id = s.vistoria_origem_id
                 WHERE s.id = p_servico_id AND v.modalidade::text = 'autovistoria') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'AUTOVISTORIA_SEM_CAMPO',
      'mensagem', 'Este card é da AUTO-VISTORIA (feita pelo celular do associado) e não vai a campo. Peça ao Monitoramento para atribuir você no card de INSTALAÇÃO desta placa.');
  END IF;

  IF v_servico.profissional_id IS NULL THEN$ins$);
  EXECUTE v_def;
END
$do$;

-- (4) buscar_tarefa_atual_profissional ------------------------------------------
DO $do$
DECLARE
  v_def text;
  v_alvo text := $a$    WHERE s.profissional_id = p_profissional_id
      AND s.status IN ('em_rota','em_andamento','agendada')$a$;
BEGIN
  SELECT pg_get_functiondef('public.buscar_tarefa_atual_profissional(uuid)'::regprocedure) INTO v_def;
  IF position('ERR-VISTH6' IN v_def) > 0 THEN
    RETURN; -- já aplicado
  END IF;
  IF position(v_alvo IN v_def) = 0 THEN
    RAISE NOTICE 'buscar_tarefa_atual_profissional: ponto de inserção não encontrado; mantida sem alteração.';
    RETURN;
  END IF;
  v_def := replace(v_def, v_alvo, v_alvo || $ins$
      -- ERR-VISTH6: autovistoria e remota, nunca e tarefa de campo
      AND COALESCE(s.modalidade::text, '') <> 'autovistoria'
      AND NOT EXISTS (SELECT 1 FROM vistorias vo
                       WHERE vo.id = s.vistoria_origem_id AND vo.modalidade::text = 'autovistoria')$ins$);
  EXECUTE v_def;
END
$do$;
