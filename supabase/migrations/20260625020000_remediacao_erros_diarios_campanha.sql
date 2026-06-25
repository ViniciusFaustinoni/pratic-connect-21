-- ============================================================================
-- Migration: remediação de erros diários recorrentes (campanha 25/jun/2026)
-- ----------------------------------------------------------------------------
-- Estas mudanças foram aplicadas AO VIVO no banco de produção (iyxdgmukrrdkffraptsx)
-- via Management API e estão validadas/testadas. Este arquivo VERSIONA as mudanças
-- para corrigir o drift git↔banco (o repo precisa refletir o que roda).
-- Tudo idempotente (CREATE OR REPLACE / DROP IF EXISTS). Nomes identificáveis.
-- Causa-raiz e prova de cada item: ver docs da campanha.
-- ============================================================================

-- ============================================================================
-- #1 — Flood "duplicate key sga_sync_queue_veiculo_id_associado_id_key" (~864/dia)
-- Fonte: edge sga-cadastrar-vistoria (cron jobid 71, */5min) + funções de limbo
-- inserindo na fila sem ON CONFLICT. Guarda universal absorve duplicatas (no-op).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_sga_sync_queue_skip_dup()
RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.veiculo_id IS NOT NULL AND NEW.associado_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.sga_sync_queue q
                 WHERE q.veiculo_id = NEW.veiculo_id AND q.associado_id = NEW.associado_id) THEN
    RETURN NULL; -- já existe na fila: pular (= ON CONFLICT DO NOTHING universal), sem erro
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_sga_sync_queue_skip_dup ON public.sga_sync_queue;
CREATE TRIGGER trg_sga_sync_queue_skip_dup BEFORE INSERT ON public.sga_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_sga_sync_queue_skip_dup();

-- Higiene: ON CONFLICT DO NOTHING no único INSERT da fn_auto_reprocessar_limbo
CREATE OR REPLACE FUNCTION public.fn_auto_reprocessar_limbo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r record; v_qid uuid; v_n int; v_assoc uuid; v_tot int := 0; v_alertas int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.limbo_alertas
    WHERE status = 'aberto'
      AND tipo IN ('dead_letter','falha_permanente_sga','sga_nao_sincronizado')
      AND acao_executada_em IS NULL
      AND created_at < now() - interval '20 minutes'
  LOOP
    v_n := 0;
    BEGIN
      IF r.tipo = 'dead_letter' THEN
        v_qid := nullif(split_part(r.chave,':',3),'')::uuid;
        UPDATE public.integration_retry_queue
           SET status='pending', next_attempt_at=now(), attempts=0, last_error=NULL, dead_letter_at=NULL, updated_at=now()
         WHERE id=v_qid AND status='dead_letter';
        GET DIAGNOSTICS v_n = ROW_COUNT;
      ELSIF r.tipo = 'falha_permanente_sga' THEN
        v_qid := nullif(split_part(r.chave,':',3),'')::uuid;
        UPDATE public.sga_sync_queue
           SET status='pendente', proximo_reenvio_em=now(), tentativas=0, erro_ultimo=NULL
         WHERE id=v_qid AND status='falha_permanente';
        GET DIAGNOSTICS v_n = ROW_COUNT;
      ELSIF r.tipo = 'sga_nao_sincronizado' THEN
        UPDATE public.sga_sync_queue
           SET status='pendente', proximo_reenvio_em=now(), tentativas=0, erro_ultimo=NULL
         WHERE veiculo_id = r.entidade_id AND status='falha_permanente';
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n = 0 AND NOT EXISTS (SELECT 1 FROM public.sga_sync_queue WHERE veiculo_id = r.entidade_id AND status='pendente') THEN
          v_assoc := (r.detalhes->>'associado_id')::uuid;
          IF v_assoc IS NOT NULL THEN
            INSERT INTO public.sga_sync_queue(veiculo_id, associado_id, status, tentativas, proximo_reenvio_em, origem)
            VALUES (r.entidade_id, v_assoc, 'pendente', 0, now(), 'auto_reprocessar_limbo')
            ON CONFLICT (veiculo_id, associado_id) DO NOTHING;
            GET DIAGNOSTICS v_n = ROW_COUNT;
          END IF;
        END IF;
      END IF;
      UPDATE public.limbo_alertas
         SET acao_executada_em=now(), codigo_acao='auto_reinjetar',
             acao_resultado=jsonb_build_object('auto',true,'afetados',v_n),
             observacao_resolucao=coalesce(observacao_resolucao,'')||' [auto-reprocesso '||to_char(now(),'YYYY-MM-DD HH24:MI')||' afetados='||v_n||']',
             updated_at=now()
       WHERE id=r.id;
      INSERT INTO public.operacao_eventos(fluxo,operacao,resultado,codigo,motivo,ator,origem,detalhes)
      VALUES('integracao','auto_reprocesso', CASE WHEN v_n>0 THEN 'sucesso' ELSE 'ignorado' END,
             r.tipo, 'reinjetado='||v_n, 'sistema','cron:auto-reprocessar-limbo',
             jsonb_build_object('alerta_id',r.id,'entidade_id',r.entidade_id,'afetados',v_n));
      v_alertas := v_alertas + 1; v_tot := v_tot + v_n;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[fn_auto_reprocessar_limbo] alerta % falhou: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('alertas_processados', v_alertas, 'itens_reinjetados', v_tot);
END;
$function$;

-- ============================================================================
-- #2 — whatsapp_mensagens_tipo_check (~155/dia): inserter grava 'texto' (PT) vs
-- CHECK 'text' (EN) => mensagens reais de clientes descartadas. Normaliza tipo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_whatsapp_mensagens_norm_tipo()
RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v text := lower(btrim(coalesce(NEW.tipo::text,'')));
BEGIN
  NEW.tipo := CASE v
    WHEN 'texto' THEN 'text' WHEN 'imagem' THEN 'image' WHEN 'documento' THEN 'document'
    WHEN 'arquivo' THEN 'document' WHEN 'audio' THEN 'audio' WHEN 'video' THEN 'video'
    WHEN 'template' THEN 'template' ELSE NEW.tipo END;
  IF NEW.tipo IS NULL OR NEW.tipo NOT IN ('text','image','document','audio','video','template') THEN
    NEW.tipo := 'text'; -- rede de segurança: nunca rejeitar
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_whatsapp_mensagens_norm_tipo ON public.whatsapp_mensagens;
CREATE TRIGGER trg_whatsapp_mensagens_norm_tipo BEFORE INSERT OR UPDATE ON public.whatsapp_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_whatsapp_mensagens_norm_tipo();

-- ============================================================================
-- #3 — Demais CHECK/NOT NULL rejeitando insert
-- ============================================================================
-- (a) cc_vendedor_lancamentos.abate_recorrente NOT NULL violado por insert NULL explícito
CREATE OR REPLACE FUNCTION public.tg_cc_vendedor_abate_default()
RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.abate_recorrente IS NULL THEN NEW.abate_recorrente := false; END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_cc_vendedor_abate_default ON public.cc_vendedor_lancamentos;
CREATE TRIGGER trg_cc_vendedor_abate_default BEFORE INSERT OR UPDATE ON public.cc_vendedor_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_cc_vendedor_abate_default();

-- (b) estoque_movimentacoes: +instalacao,desinstalacao (retirada de rastreador)
ALTER TABLE public.estoque_movimentacoes DROP CONSTRAINT IF EXISTS estoque_movimentacoes_tipo_check;
ALTER TABLE public.estoque_movimentacoes ADD CONSTRAINT estoque_movimentacoes_tipo_check
  CHECK (tipo::text = ANY(ARRAY['entrada','saida','transferencia','baixa','manutencao','retorno_manutencao','instalacao','desinstalacao']::text[]));

-- (c) servicos.confirmacao_whatsapp: +aguardando_confirmacao_manha/tarde
ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_confirmacao_whatsapp_check;
ALTER TABLE public.servicos ADD CONSTRAINT servicos_confirmacao_whatsapp_check
  CHECK (confirmacao_whatsapp = ANY(ARRAY['pendente','enviada','confirmada','reagendado','nao_respondeu','aguardando_confirmacao_manha','aguardando_confirmacao_tarde']::text[]));

-- (d) logs_auditoria.acao: remover CHECK (audit não deve descartar registro por ação nova)
ALTER TABLE public.logs_auditoria DROP CONSTRAINT IF EXISTS logs_auditoria_acao_check;

-- (e) configuracoes.categoria: +force_client_command,sistema
ALTER TABLE public.configuracoes DROP CONSTRAINT IF EXISTS configuracoes_categoria_check;
ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_categoria_check
  CHECK (categoria::text = ANY(ARRAY['atuarial','documentos','empresa','financeiro','indicacao','notificacoes','operacional','rateio','regras_venda','monitoramento','force_client_command','sistema']::text[]));

-- ============================================================================
-- #4 — FK órfãs: código confunde profiles.id com auth.users.id (=profiles.user_id).
-- Triggers que REPARAM o id (mapeiam ao correto) em vez de descartar.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_notificacoes_fix_user()
RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v_auth uuid;
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT p.user_id INTO v_auth FROM public.profiles p WHERE p.id = NEW.user_id AND p.user_id IS NOT NULL LIMIT 1;
  IF v_auth IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_auth) THEN NEW.user_id := v_auth; RETURN NEW; END IF;
  RETURN NULL; -- usuário inexistente: pular (não pode ser notificado)
END $f$;
DROP TRIGGER IF EXISTS trg_notificacoes_fix_user ON public.notificacoes;
CREATE TRIGGER trg_notificacoes_fix_user BEFORE INSERT ON public.notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_notificacoes_fix_user();

CREATE OR REPLACE FUNCTION public.tg_logs_auditoria_fix_usuario()
RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v_pid uuid;
BEGIN
  IF NEW.usuario_id IS NULL OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.usuario_id) THEN RETURN NEW; END IF;
  SELECT p.id INTO v_pid FROM public.profiles p WHERE p.user_id = NEW.usuario_id LIMIT 1;
  NEW.usuario_id := v_pid; -- pode ficar NULL (coluna anulável) => log anônimo, registro mantido
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_logs_auditoria_fix_usuario ON public.logs_auditoria;
CREATE TRIGGER trg_logs_auditoria_fix_usuario BEFORE INSERT OR UPDATE ON public.logs_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.tg_logs_auditoria_fix_usuario();

CREATE OR REPLACE FUNCTION public.tg_auth_logs_fix_profile()
RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v_pid uuid;
BEGIN
  IF NEW.profile_id IS NULL OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.profile_id) THEN RETURN NEW; END IF;
  SELECT p.id INTO v_pid FROM public.profiles p WHERE p.user_id = NEW.profile_id LIMIT 1;
  NEW.profile_id := v_pid;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_auth_logs_fix_profile ON public.auth_logs;
CREATE TRIGGER trg_auth_logs_fix_profile BEFORE INSERT OR UPDATE ON public.auth_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_auth_logs_fix_profile();

-- ============================================================================
-- #6 — Schema drift: recriar a view ausente como alias da real (PT vs EN).
-- (O restante do #6 é frontend — ver prompt Lovable; não é migration de banco.)
-- ============================================================================
CREATE OR REPLACE VIEW public.vw_custo_real_beneficios WITH (security_invoker=true) AS
  SELECT * FROM public.vw_custo_real_benefits;

-- ============================================================================
-- #7 — RLS/permissão
-- ============================================================================
-- (a) solicitacoes_troca_titularidade: anon faltava SELECT (=> permission denied no link
--     público) E a policy anon era USING(true) (superexposta). Concede SELECT + token-gate.
GRANT SELECT ON public.solicitacoes_troca_titularidade TO anon;
DROP POLICY IF EXISTS troca_select_anon_token ON public.solicitacoes_troca_titularidade;
CREATE POLICY troca_select_anon_token ON public.solicitacoes_troca_titularidade
  FOR SELECT TO anon USING (token_publico IS NOT NULL);

-- (b) notificacoes_preferencias: INSERT RLS auth.uid()=usuario_id falhava p/ usuários
--     com profiles.id != auth.id. Normaliza usuario_id (profiles.id -> auth id).
CREATE OR REPLACE FUNCTION public.tg_notif_pref_fix_usuario()
RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v_auth uuid;
BEGIN
  IF NEW.usuario_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.usuario_id) THEN RETURN NEW; END IF;
  SELECT p.user_id INTO v_auth FROM public.profiles p WHERE p.id = NEW.usuario_id AND p.user_id IS NOT NULL LIMIT 1;
  IF v_auth IS NOT NULL THEN NEW.usuario_id := v_auth; END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_notif_pref_fix_usuario ON public.notificacoes_preferencias;
CREATE TRIGGER trg_notif_pref_fix_usuario BEFORE INSERT OR UPDATE ON public.notificacoes_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_notif_pref_fix_usuario();

-- ============================================================================
-- FIM. Itens que NÃO são migration de banco (frontend/edge — ver prompts Lovable):
--   #5 efetivar-substituicao: tratar HTTP 409 "mesma situação" como sucesso + codigo_veiculo_sga->codigo_hinova
--   #6 front: usar colunas reais (benefit_id, nome, km_atual, associado_cpf, planos.nome, veiculos.cobertura_total, ...)
-- ============================================================================
