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
-- Correção (a atribuição do técnico é válida e segue para o card de INSTALAÇÃO;
-- só a cópia dela para o card de AUTOVISTORIA é descartada):
--   (2) fn_guard_autovistoria_servico_disjunto: em UPDATE de card de
--       autovistoria, (a) estado terminal não volta para 'agendada' e (b) não
--       recebe técnico de campo. A escrita é neutralizada (mantém valores
--       anteriores) e registrada em log — sem erro, para não abortar o restante
--       do fluxo de atribuição, que grava em seguida o card de INSTALAÇÃO.
--       Realocação do Monitoramento (flag on) segue para
--       fn_guard_reabertura_servico_monitoramento, que já explica o bloqueio.
--   (3) iniciar_rota_servico / iniciar_tarefa_servico: autovistoria responde
--       ok=false com mensagem clara em vez de 400 de constraint.
--   (4) buscar_tarefa_atual_profissional: autovistoria nunca é tarefa de campo.
--   (1) Saneamento: card de autovistoria agendado com técnico (QQG4D99,
--       VEN-2026-01606) volta a 'cancelada', sem técnico — estado gravado pelo
--       sistema às 15:48:40. O atendimento do caso já segue no card de
--       INSTALAÇÃO INS-2026-01101 (técnico atribuído em 15/10).
-- =============================================================================

-- (2) Guard -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_autovistoria_servico_disjunto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_autovistoria boolean := false;
  v_neutralizou text := '';
BEGIN
  -- Detecta autovistoria pela vistoria de origem OU pela modalidade do proprio servico
  IF NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT (modalidade = 'autovistoria') INTO v_is_autovistoria
    FROM public.vistorias
    WHERE id = NEW.vistoria_origem_id;
  END IF;
  IF COALESCE(v_is_autovistoria, false) = false AND NEW.modalidade = 'autovistoria' THEN
    v_is_autovistoria := true;
  END IF;

  IF COALESCE(v_is_autovistoria, false) = false THEN
    RETURN NEW;
  END IF;

  -- 0) ERR-VISTH6: autovistoria e remota e nao entra na fila de campo. A
  --    atribuicao de tecnico vale para o card de INSTALACAO; a copia dela para
  --    este card e neutralizada (sem erro, para nao abortar o fluxo que grava a
  --    instalacao logo em seguida). Realocacao (flag on) segue para
  --    fn_guard_reabertura_servico_monitoramento, que explica o bloqueio.
  IF TG_OP = 'UPDATE'
     AND COALESCE(current_setting('app.realocacao_monitoramento', true), '') <> 'on' THEN
    IF OLD.status::text IN ('cancelada','aprovada','reprovada','concluida')
       AND NEW.status::text = 'agendada' THEN
      v_neutralizou := v_neutralizou || ' status ' || OLD.status::text || '->agendada;';
      NEW.status := OLD.status;
    END IF;
    IF NEW.profissional_id IS NOT NULL
       AND NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
      v_neutralizou := v_neutralizou || ' profissional_id '
        || COALESCE(OLD.profissional_id::text, 'null') || '->' || NEW.profissional_id::text || ';';
      NEW.profissional_id := OLD.profissional_id;
    END IF;
    IF v_neutralizou <> '' THEN
      INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
      VALUES ('editar', 'operacoes', 'servicos', NEW.id,
              '[AUTOVISTORIA_FORA_DO_CAMPO] escrita neutralizada:' || v_neutralizou
              || ' (autovistoria nao vai a campo; a atribuicao vale no card de INSTALACAO).');
    END IF;
  END IF;

  -- 1) Servico de autovistoria NUNCA pode vincular instalacao_origem_id
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    RAISE EXCEPTION 'Servico de autovistoria nao pode ser vinculado a instalacao fisica (instalacao_origem_id=%).', NEW.instalacao_origem_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 1b) Servico de autovistoria NUNCA pode ter tipo de tarefa de campo fisica.
  --     Foi a causa-raiz do incidente SRZ3G30 (tipo alterado manualmente para 'instalacao' no agendamento).
  IF NEW.tipo::text IN ('instalacao','manutencao','retirada') THEN
    RAISE EXCEPTION 'Servico de autovistoria nao pode ter tipo de tarefa de campo (% ). Autovistoria e remota; agende a instalacao presencial em um servico proprio.', NEW.tipo
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2) Status permitidos para servico de autovistoria (inclui concluida e agendada)
  IF NEW.status NOT IN ('em_analise','aprovada','reprovada','cancelada','concluida','agendada') THEN
    RAISE EXCEPTION 'Status % invalido para servico de autovistoria (permitidos: em_analise, aprovada, reprovada, cancelada, concluida, agendada).', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

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

-- (1) Saneamento do card do incidente --------------------------------------------
-- Roda depois do guard: 'agendada'->'cancelada' e técnico->NULL não são
-- neutralizados (OLD não é terminal; técnico novo é NULL).
UPDATE public.servicos
   SET status = 'cancelada',
       profissional_id = NULL,
       observacoes = COALESCE(observacoes, '') || E'\n' ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') ||
         '] SANEAMENTO ERR-VISTH6: card de autovistoria (ja aprovada) reaberto pela atribuicao de tecnico em 15/10 12:48; devolvido a cancelada, sem tecnico. Atendimento segue no card de INSTALACAO INS-2026-01101.',
       updated_at = now()
 WHERE id = '227a8e51-e9fa-4fae-ac57-bdeec29d26a6'
   AND status = 'agendada'
   AND modalidade = 'autovistoria';
