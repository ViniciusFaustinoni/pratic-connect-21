-- Passo 1: Patch recompute_cotacao_status_contratacao — promoção a 'ativo' só pelo caminho canônico do veículo
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
  v_aprovado_em timestamptz;
  v_veiculo_status text;
  v_caminho_canonico_completo boolean := false;
begin
  select status, status_contratacao into v_cot_status, v_current from cotacoes where id = p_cotacao_id;
  if not found then return; end if;

  select ct.id, ct.status, ct.adesao_paga, ct.cadastro_aprovado, ct.aprovado_em, a.status, v.status
    into v_contrato_id, v_contrato_status, v_adesao_paga, v_cadastro_aprovado, v_aprovado_em, v_associado_status, v_veiculo_status
  from contratos ct
    left join associados a on a.id = ct.associado_id
    left join veiculos v on v.id = ct.veiculo_id
  where ct.cotacao_id = p_cotacao_id order by ct.created_at desc limit 1;

  select exists(select 1 from instalacoes where cotacao_id = p_cotacao_id and status::text = 'concluida') into v_inst_concluida;
  select status::text into v_inst_status from instalacoes where cotacao_id = p_cotacao_id order by created_at desc limit 1;

  select exists(
    select 1 from vistorias
     where cotacao_id = p_cotacao_id and modalidade = 'autovistoria' and status = 'aprovada'
  ) into v_autovistoria_aprovada;

  -- Caminho canônico do veículo desta cotação: Cadastro aprovou + ativar-associado promoveu contrato + veículo ativo
  v_caminho_canonico_completo := (
    coalesce(v_cadastro_aprovado, false) = true
    and v_aprovado_em is not null
    and v_contrato_status = 'ativo'
    and v_veiculo_status = 'ativo'
  );

  v_new := case
    when v_associado_status = 'cancelado' or v_contrato_status = 'cancelado' or v_current = 'cancelado' then 'cancelado'
    when v_cot_status = 'recusada' or v_current = 'veiculo_recusado' then 'veiculo_recusado'
    -- Promoção a 'ativo' EXIGE caminho canônico do veículo desta cotação
    -- (não basta associado já estar ativo de outro veículo — caso substituição/inclusão)
    when v_caminho_canonico_completo then 'ativo'
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

-- Passo 2: Guard BEFORE UPDATE — bloqueia transição para 'ativo' sem caminho canônico
CREATE OR REPLACE FUNCTION public.fn_guard_cotacao_ativo_exige_caminho_canonico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_ct_status text;
  v_cadastro_aprovado boolean;
  v_aprovado_em timestamptz;
  v_veiculo_status text;
begin
  if NEW.status_contratacao is distinct from OLD.status_contratacao
     and NEW.status_contratacao = 'ativo'
     and coalesce(OLD.status_contratacao,'') <> 'ativo'
  then
    select ct.status, ct.cadastro_aprovado, ct.aprovado_em, v.status
      into v_ct_status, v_cadastro_aprovado, v_aprovado_em, v_veiculo_status
    from contratos ct
      left join veiculos v on v.id = ct.veiculo_id
    where ct.cotacao_id = NEW.id
    order by ct.created_at desc limit 1;

    if coalesce(v_cadastro_aprovado,false) is not true
       or v_aprovado_em is null
       or coalesce(v_ct_status,'') <> 'ativo'
       or coalesce(v_veiculo_status,'') <> 'ativo'
    then
      raise exception
        'cotacao % nao pode ir para status_contratacao=ativo sem caminho canonico do veiculo (cadastro_aprovado=%, aprovado_em=%, contrato.status=%, veiculo.status=%). Caminho canonico = Cadastro aprova + Monitoramento aprova + ativar-associado.',
        NEW.id, v_cadastro_aprovado, v_aprovado_em, v_ct_status, v_veiculo_status
      using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end; $$;

DROP TRIGGER IF EXISTS trg_guard_cotacao_ativo_exige_caminho_canonico ON public.cotacoes;
CREATE TRIGGER trg_guard_cotacao_ativo_exige_caminho_canonico
BEFORE UPDATE ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_cotacao_ativo_exige_caminho_canonico();