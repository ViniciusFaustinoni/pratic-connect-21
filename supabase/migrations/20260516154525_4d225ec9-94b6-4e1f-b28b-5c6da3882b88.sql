CREATE OR REPLACE FUNCTION public.recompute_cotacao_status_contratacao(p_cotacao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cot_status text;
  v_contrato_status text;
  v_adesao_paga boolean;
  v_associado_status text;
  v_inst_status text;
  v_new text;
  v_current text;
begin
  select status, status_contratacao
    into v_cot_status, v_current
  from cotacoes where id = p_cotacao_id;

  if not found then return; end if;

  select ct.status, ct.adesao_paga, a.status
    into v_contrato_status, v_adesao_paga, v_associado_status
  from contratos ct
  left join associados a on a.id = ct.associado_id
  where ct.cotacao_id = p_cotacao_id
  order by ct.created_at desc
  limit 1;

  if v_current in (
      'aguardando_aprovacao_cadastro',
      'aguardando_aprovacao_monitoramento',
      'vistoria_concluida'
    )
    and coalesce(v_contrato_status,'') <> 'cancelado'
    and coalesce(v_associado_status,'') not in ('cancelado','recusado')
    and coalesce(v_cot_status,'') <> 'recusada'
  then
    return;
  end if;

  select status into v_inst_status
  from instalacoes
  where cotacao_id = p_cotacao_id
  order by created_at desc
  limit 1;

  v_new := case
    when v_associado_status = 'cancelado'
      or v_contrato_status = 'cancelado'
      or v_current = 'cancelado'                                    then 'cancelado'
    when v_cot_status = 'recusada' or v_current = 'veiculo_recusado' then 'veiculo_recusado'
    when v_associado_status = 'ativo'
      and v_contrato_status in ('assinado','ativo')                  then 'ativo'
    when v_inst_status in ('agendada','reagendada')
      and v_adesao_paga is true                                      then 'vistoria_agendada'
    when v_adesao_paga is true
      and v_contrato_status in ('assinado','ativo')                  then 'pagamento_ok'
    when v_contrato_status in ('assinado','ativo')                   then 'contrato_assinado'
    when v_current in ('vistoria_ok','documentos_ok','dados_preenchidos','plano_escolhido')
                                                                     then v_current
    when v_contrato_status in ('pendente_assinatura','enviado','visualizado')
                                                                     then coalesce(nullif(v_current,'aguardando'), 'documentos_ok')
    else coalesce(v_current, 'aguardando')
  end;

  if v_new is distinct from v_current then
    update cotacoes
       set status_contratacao = v_new,
           updated_at = now()
     where id = p_cotacao_id;
  end if;
end;
$function$;

WITH alvo AS (
  SELECT c.id, c.numero
  FROM cotacoes c
  JOIN contratos ct ON ct.cotacao_id = c.id
  JOIN associados a ON a.id = ct.associado_id
  WHERE c.status_contratacao = 'contrato_assinado'
    AND ct.status <> 'cancelado'
    AND a.status NOT IN ('cancelado','recusado')
    AND ct.cadastro_aprovado = false
    AND EXISTS (
      SELECT 1 FROM vistorias v
      WHERE v.cotacao_id = c.id
        AND v.origem = 'autovistoria_publica'
    )
), upd AS (
  UPDATE cotacoes c
     SET status_contratacao = 'aguardando_aprovacao_cadastro',
         updated_at = now()
    FROM alvo
   WHERE c.id = alvo.id
  RETURNING c.id, c.numero
)
INSERT INTO logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos)
SELECT 'editar',
       'cotacoes',
       'cotacoes',
       upd.id,
       'Backfill pós-patch recompute: status restaurado de contrato_assinado para aguardando_aprovacao_cadastro (bug rebobinava status pós-autovistoria em mudança de associados.status)',
       jsonb_build_object('numero', upd.numero, 'de','contrato_assinado','para','aguardando_aprovacao_cadastro','origem','backfill_status_pos_autovistoria')
FROM upd;