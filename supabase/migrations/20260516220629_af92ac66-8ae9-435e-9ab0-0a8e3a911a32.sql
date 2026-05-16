
-- ============================================================
-- FRENTE 1: sync_servico_on_vistoria_decisao consciente da modalidade
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_servico_on_vistoria_decisao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_novo_status_servico text;
  v_novo_status_agend   text;
  v_novo_status_inst    text;
  v_instalacao_id       uuid;
  v_cotacao_id          uuid;
  v_is_autovistoria     boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('aprovada','aprovada_ressalvas','reprovada','cancelada') THEN

    v_is_autovistoria := COALESCE(NEW.modalidade, '') = 'autovistoria';

    v_novo_status_servico := CASE NEW.status::text
                               WHEN 'reprovada' THEN 'cancelada'
                               WHEN 'cancelada' THEN 'cancelada'
                               ELSE 'concluida'
                             END;

    v_novo_status_agend := CASE NEW.status::text
                             WHEN 'reprovada' THEN 'cancelado'
                             WHEN 'cancelada' THEN 'cancelado'
                             ELSE 'realizado'
                           END;

    v_novo_status_inst := CASE NEW.status::text
                            WHEN 'reprovada' THEN 'cancelada'
                            WHEN 'cancelada' THEN 'cancelada'
                            ELSE 'concluida'
                          END;

    IF v_is_autovistoria THEN
      UPDATE public.servicos
         SET status = v_novo_status_servico::status_servico,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE vistoria_origem_id = NEW.id
         AND tipo IN ('vistoria_entrada')
         AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

      UPDATE public.agendamentos_base
         SET status = v_novo_status_agend,
             updated_at = now()
       WHERE vistoria_id = NEW.id
         AND status NOT IN ('realizado','cancelado');

      RETURN NEW;
    END IF;

    UPDATE public.servicos
       SET status = v_novo_status_servico::status_servico,
           concluida_em = COALESCE(concluida_em, now()),
           updated_at = now()
     WHERE vistoria_origem_id = NEW.id
       AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

    UPDATE public.agendamentos_base
       SET status = v_novo_status_agend,
           updated_at = now()
     WHERE vistoria_id = NEW.id
       AND status NOT IN ('realizado','cancelado');

    v_instalacao_id := NEW.instalacao_id;
    v_cotacao_id    := NEW.cotacao_id;

    IF v_instalacao_id IS NULL THEN
      SELECT ab.instalacao_id INTO v_instalacao_id
        FROM public.agendamentos_base ab
       WHERE ab.vistoria_id = NEW.id AND ab.instalacao_id IS NOT NULL
       ORDER BY ab.created_at DESC LIMIT 1;
    END IF;

    IF v_instalacao_id IS NULL AND v_cotacao_id IS NOT NULL THEN
      SELECT i.id INTO v_instalacao_id
        FROM public.instalacoes i WHERE i.cotacao_id = v_cotacao_id
       ORDER BY i.created_at DESC LIMIT 1;
    END IF;

    IF v_instalacao_id IS NOT NULL THEN
      UPDATE public.instalacoes
         SET status = v_novo_status_inst::status_instalacao,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE id = v_instalacao_id
         AND status::text NOT IN ('concluida','cancelada');

      UPDATE public.servicos
         SET status = v_novo_status_servico::status_servico,
             concluida_em = COALESCE(concluida_em, now()),
             updated_at = now()
       WHERE instalacao_origem_id = v_instalacao_id
         AND status::text IN ('agendada','em_rota','em_andamento','pendente','reagendada','em_analise');

      IF NEW.instalacao_id IS NULL THEN
        UPDATE public.vistorias SET instalacao_id = v_instalacao_id WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- FRENTE 1b: guard físico — instalação só conclui com rastreador
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_instalacao_concluida_exige_rastreador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_fipe numeric; v_combustivel text; v_marca text; v_modelo text;
  v_dispensa boolean; v_is_moto boolean; v_exige boolean;
BEGIN
  IF NEW.status::text <> 'concluida' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'concluida' THEN RETURN NEW; END IF;

  v_dispensa := COALESCE(NEW.dispensa_rastreador, false);
  IF v_dispensa THEN RETURN NEW; END IF;
  IF NEW.rastreador_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT v.valor_fipe, v.combustivel, v.marca, v.modelo
    INTO v_valor_fipe, v_combustivel, v_marca, v_modelo
    FROM public.veiculos v WHERE v.id = NEW.veiculo_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF LOWER(COALESCE(v_combustivel,'')) LIKE '%diesel%' THEN
    RAISE EXCEPTION 'instalacao_concluida_exige_rastreador: veículo Diesel (instalacao=%) — vincule rastreador físico antes de concluir.', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  v_is_moto := LOWER(COALESCE(v_marca,'')) ~ '(honda|yamaha|suzuki|kawasaki|harley|bmw motorrad|royal enfield|dafra|haojue|shineray|kasinski|triumph|husqvarna|ducati|mv agusta|cf moto|sym|piaggio|vespa|traxx|sundown|garinni|kymco)'
              OR LOWER(COALESCE(v_modelo,'')) ~ '(cb |cg |titan|biz|nmax|xre|fazer|bros|pop |xtz|hornet|cbr|gixxer|burgman|ybr|fan |factor)';

  v_exige := CASE WHEN v_is_moto THEN COALESCE(v_valor_fipe,0) >= 9000 ELSE COALESCE(v_valor_fipe,0) >= 30000 END;

  IF v_exige THEN
    RAISE EXCEPTION 'instalacao_concluida_exige_rastreador: veículo FIPE R$ % exige rastreador (instalacao=%).', v_valor_fipe, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_instalacao_concluida_exige_rastreador ON public.instalacoes;
CREATE TRIGGER trg_guard_instalacao_concluida_exige_rastreador
BEFORE INSERT OR UPDATE OF status ON public.instalacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_instalacao_concluida_exige_rastreador();

-- ============================================================
-- FRENTE 4: recompute autovistoria-aware
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_cotacao_status_contratacao(p_cotacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_cot_status text; v_contrato_status text; v_adesao_paga boolean;
  v_associado_status text; v_inst_status text; v_new text; v_current text;
  v_inst_concluida boolean := false;
  v_cadastro_aprovado boolean := false;
  v_autovistoria_aprovada boolean := false;
  v_contrato_id uuid;
begin
  select status, status_contratacao into v_cot_status, v_current from cotacoes where id = p_cotacao_id;
  if not found then return; end if;

  select ct.id, ct.status, ct.adesao_paga, ct.cadastro_aprovado, a.status
    into v_contrato_id, v_contrato_status, v_adesao_paga, v_cadastro_aprovado, v_associado_status
  from contratos ct left join associados a on a.id = ct.associado_id
  where ct.cotacao_id = p_cotacao_id order by ct.created_at desc limit 1;

  select exists(select 1 from instalacoes where cotacao_id = p_cotacao_id and status::text = 'concluida') into v_inst_concluida;
  select status::text into v_inst_status from instalacoes where cotacao_id = p_cotacao_id order by created_at desc limit 1;

  select exists(
    select 1 from vistorias
     where cotacao_id = p_cotacao_id and modalidade = 'autovistoria' and status = 'aprovada'
  ) into v_autovistoria_aprovada;

  v_new := case
    when v_associado_status = 'cancelado' or v_contrato_status = 'cancelado' or v_current = 'cancelado' then 'cancelado'
    when v_cot_status = 'recusada' or v_current = 'veiculo_recusado' then 'veiculo_recusado'
    when v_associado_status = 'ativo' and v_contrato_status in ('assinado','ativo') then 'ativo'
    when v_inst_concluida and v_adesao_paga is true then 'pagamento_ok'
    when v_autovistoria_aprovada and v_cadastro_aprovado is not true then 'aguardando_aprovacao_cadastro'
    when v_autovistoria_aprovada and v_cadastro_aprovado is true and not v_inst_concluida then 'autovistoria_ok'
    when v_inst_status in ('agendada','reagendada') and v_adesao_paga is true then 'vistoria_agendada'
    when v_adesao_paga is true and v_contrato_status in ('assinado','ativo') then 'pagamento_ok'
    when v_contrato_status in ('assinado','ativo') then 'contrato_assinado'
    when v_current in ('vistoria_ok','documentos_ok','dados_preenchidos','plano_escolhido','autovistoria_ok',
                       'aguardando_aprovacao_cadastro','vistoria_concluida','aguardando_aprovacao_monitoramento',
                       'vistoria_agendada') then v_current
    when v_contrato_status in ('pendente_assinatura','enviado','visualizado')
      then coalesce(nullif(v_current,'aguardando'), 'documentos_ok')
    else coalesce(v_current, 'aguardando')
  end;

  if v_new is distinct from v_current then
    if v_new in ('cancelado','veiculo_recusado','aguardando_aprovacao_cadastro','autovistoria_ok')
       or public.rank_status_contratacao(v_new) >= public.rank_status_contratacao(coalesce(v_current,'aguardando'))
    then
      update cotacoes set status_contratacao = v_new, updated_at = now() where id = p_cotacao_id;
    end if;
  end if;
end; $function$;

-- ============================================================
-- FRENTE 4b: trigger recalcula cotação quando vistoria muda
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_recompute_cotacao_on_vistoria_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cotacao_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.recompute_cotacao_status_contratacao(NEW.cotacao_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recompute_cotacao_on_vistoria_status ON public.vistorias;
CREATE TRIGGER trg_recompute_cotacao_on_vistoria_status
AFTER INSERT OR UPDATE OF status ON public.vistorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_recompute_cotacao_on_vistoria_status();

-- ============================================================
-- FRENTE 5: BACKFILL — 11 contratos contaminados
-- ============================================================
DO $backfill$
DECLARE
  r RECORD;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT i.id as instalacao_id, i.contrato_id, i.veiculo_id, c2.associado_id, v.placa, v.valor_fipe
      FROM instalacoes i
      JOIN contratos c2 ON c2.id = i.contrato_id
      LEFT JOIN veiculos v ON v.id = i.veiculo_id
     WHERE i.status = 'concluida'
       AND i.rastreador_id IS NULL
       AND COALESCE(v.valor_fipe,0) >= 30000
  LOOP
    UPDATE instalacoes
       SET status = 'agendada', concluida_em = NULL,
           data_agendada = CURRENT_DATE + 2, updated_at = now()
     WHERE id = r.instalacao_id;

    UPDATE veiculos
       SET cobertura_total = false, status = 'instalacao_pendente', updated_at = now()
     WHERE id = r.veiculo_id;

    UPDATE contratos
       SET status = 'assinado', updated_at = now()
     WHERE id = r.contrato_id AND status = 'ativo';

    UPDATE associados
       SET status = 'aguardando_instalacao', updated_at = now()
     WHERE id = r.associado_id AND status = 'ativo';

    UPDATE servicos
       SET status = 'agendada', concluida_em = NULL, updated_at = now()
     WHERE contrato_id = r.contrato_id
       AND tipo = 'instalacao'
       AND status = 'concluida'
       AND rastreador_id IS NULL;

    INSERT INTO associados_historico (associado_id, contrato_id, tipo, descricao)
    VALUES (
      r.associado_id, r.contrato_id, 'observacao_adicionada',
      'SANEAMENTO AUTOMÁTICO: instalação ' || r.instalacao_id || ' (placa ' || COALESCE(r.placa,'?') || ', FIPE R$ ' || COALESCE(r.valor_fipe::text,'?') ||
      ') estava marcada como concluída sem rastreador físico vinculado por causa de gatilho que propagava aprovação de autovistoria para a instalação. Instalação reaberta como AGENDADA, contrato rebaixado para ASSINADO, cobertura Roubo/Furto preservada (autovistoria já validou), cobertura total desligada até instalação real ocorrer. Monitoramento deve revisar manualmente.'
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill concluído: % instalações fantasma reabertas.', v_count;
END;
$backfill$;

-- Recompute do Leonardo e quaisquer outros com autovistoria pendente
DO $recompute_pending$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT v.cotacao_id FROM vistorias v
     WHERE v.modalidade = 'autovistoria' AND v.status = 'aprovada' AND v.cotacao_id IS NOT NULL
  LOOP
    PERFORM public.recompute_cotacao_status_contratacao(r.cotacao_id);
  END LOOP;
END;
$recompute_pending$;
