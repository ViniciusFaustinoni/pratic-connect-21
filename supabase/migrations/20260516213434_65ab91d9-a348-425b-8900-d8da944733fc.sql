
CREATE OR REPLACE FUNCTION public.rank_status_contratacao(p text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p
    WHEN 'aguardando' THEN 0 WHEN 'plano_escolhido' THEN 1 WHEN 'dados_preenchidos' THEN 2
    WHEN 'documentos_ok' THEN 3 WHEN 'autovistoria_ok' THEN 4 WHEN 'contrato_assinado' THEN 5
    WHEN 'vistoria_ok' THEN 6 WHEN 'aguardando_aprovacao_cadastro' THEN 7
    WHEN 'vistoria_concluida' THEN 8 WHEN 'aguardando_aprovacao_monitoramento' THEN 9
    WHEN 'vistoria_agendada' THEN 10 WHEN 'pagamento_ok' THEN 11
    WHEN 'contrato_gerado' THEN 12 WHEN 'ativo' THEN 13 ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_cotacao_status_contratacao(p_cotacao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_cot_status text; v_contrato_status text; v_adesao_paga boolean;
  v_associado_status text; v_inst_status text; v_new text; v_current text;
  v_inst_concluida boolean := false;
begin
  select status, status_contratacao into v_cot_status, v_current from cotacoes where id = p_cotacao_id;
  if not found then return; end if;

  select ct.status, ct.adesao_paga, a.status into v_contrato_status, v_adesao_paga, v_associado_status
  from contratos ct left join associados a on a.id = ct.associado_id
  where ct.cotacao_id = p_cotacao_id order by ct.created_at desc limit 1;

  select exists(select 1 from instalacoes where cotacao_id = p_cotacao_id and status::text = 'concluida') into v_inst_concluida;
  select status::text into v_inst_status from instalacoes where cotacao_id = p_cotacao_id order by created_at desc limit 1;

  v_new := case
    when v_associado_status = 'cancelado' or v_contrato_status = 'cancelado' or v_current = 'cancelado' then 'cancelado'
    when v_cot_status = 'recusada' or v_current = 'veiculo_recusado' then 'veiculo_recusado'
    when v_associado_status = 'ativo' and v_contrato_status in ('assinado','ativo') then 'ativo'
    when v_inst_concluida and v_adesao_paga is true then 'pagamento_ok'
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
    if v_new in ('cancelado','veiculo_recusado')
       or public.rank_status_contratacao(v_new) >= public.rank_status_contratacao(coalesce(v_current,'aguardando'))
    then
      update cotacoes set status_contratacao = v_new, updated_at = now() where id = p_cotacao_id;
    end if;
  end if;
end; $function$;

DO $$
DECLARE r record; v_old text; v_new text;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id, c.status_contratacao AS old_status
    FROM cotacoes c
    LEFT JOIN contratos ct ON ct.cotacao_id = c.id
    LEFT JOIN associados a ON a.id = ct.associado_id
    WHERE c.status_contratacao NOT IN ('ativo','cancelado','veiculo_recusado')
      AND (a.status = 'ativo'
        OR (ct.adesao_paga = true AND ct.status IN ('assinado','ativo'))
        OR EXISTS (SELECT 1 FROM instalacoes i WHERE i.cotacao_id = c.id AND i.status::text = 'concluida'))
  LOOP
    v_old := r.old_status;
    PERFORM public.recompute_cotacao_status_contratacao(r.id);
    SELECT status_contratacao INTO v_new FROM cotacoes WHERE id = r.id;
    IF v_new IS DISTINCT FROM v_old THEN
      INSERT INTO cotacoes_historico (cotacao_id, acao, detalhes, autor_nome, created_at)
      VALUES (r.id, 'backfill_status_contratacao',
        jsonb_build_object('de', v_old, 'para', v_new, 'origem', 'migration_sync_link_publico_v3'),
        'system', now());
    END IF;
  END LOOP;
END $$;
