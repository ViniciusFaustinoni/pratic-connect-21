
-- 1) Função core: recomputa status_contratacao a partir do estado real
create or replace function public.recompute_cotacao_status_contratacao(p_cotacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  select status into v_inst_status
  from instalacoes
  where cotacao_id = p_cotacao_id
  order by created_at desc
  limit 1;

  -- Hierarquia (do mais final para o inicial):
  -- cancelado > veiculo_recusado > ativo > vistoria_agendada > pagamento_ok
  --   > contrato_assinado > vistoria_ok > documentos_ok > dados_preenchidos
  --   > plano_escolhido > aguardando
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
$$;

-- 2) Trigger handlers
create or replace function public.trg_recompute_cotacao_from_contrato()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.cotacao_id is not null then
    perform public.recompute_cotacao_status_contratacao(new.cotacao_id);
  end if;
  if tg_op='UPDATE' and old.cotacao_id is not null and old.cotacao_id is distinct from new.cotacao_id then
    perform public.recompute_cotacao_status_contratacao(old.cotacao_id);
  end if;
  return new;
end; $$;

create or replace function public.trg_recompute_cotacao_from_associado()
returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  for r in select cotacao_id from contratos where associado_id = new.id and cotacao_id is not null loop
    perform public.recompute_cotacao_status_contratacao(r.cotacao_id);
  end loop;
  return new;
end; $$;

create or replace function public.trg_recompute_cotacao_from_instalacao()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.cotacao_id is not null then
    perform public.recompute_cotacao_status_contratacao(new.cotacao_id);
  end if;
  return new;
end; $$;

-- 3) Triggers
drop trigger if exists trg_cotacao_sync_from_contrato on public.contratos;
create trigger trg_cotacao_sync_from_contrato
after insert or update of status, adesao_paga, cadastro_aprovado, cotacao_id, associado_id
on public.contratos
for each row execute function public.trg_recompute_cotacao_from_contrato();

drop trigger if exists trg_cotacao_sync_from_associado on public.associados;
create trigger trg_cotacao_sync_from_associado
after update of status on public.associados
for each row execute function public.trg_recompute_cotacao_from_associado();

drop trigger if exists trg_cotacao_sync_from_instalacao on public.instalacoes;
create trigger trg_cotacao_sync_from_instalacao
after insert or update of status on public.instalacoes
for each row execute function public.trg_recompute_cotacao_from_instalacao();

-- 4) Backfill: reconciliar todas as cotações
do $$
declare r record;
begin
  for r in select id from cotacoes loop
    perform public.recompute_cotacao_status_contratacao(r.id);
  end loop;
end $$;
