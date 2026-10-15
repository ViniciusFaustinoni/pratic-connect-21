-- Reativação acima de 60 dias conta como nova adesão: é VENDA DO CONSULTOR.
-- Ela só nasce como cotação de reativação do consultor (gera contrato novo, que a
-- Corrida credita ao vendedor do contrato). A negociação do Relacionamento
-- (reativacao_negociacoes) fica restrita à revistoria (<= 60 dias, 'negociacao_60d').
--
-- Até aqui só a tela barrava (ReativacaoWizard, desde 07/out); a tabela aceita escrita
-- de qualquer funcionário, e entre 21/09 e 06/10 entraram 8 reativações > 60 dias sem
-- consultor e sem contrato — nenhuma contou na Corrida.
--
-- Estado proibido: 'nova_venda' SEM cotação e fora de teste. Barra a ENTRADA nesse
-- estado (insert, troca de tipo, retirada da cotação, teste virando real). Linhas que
-- já estavam nele (legado) continuam editáveis — o passado não é tocado.
-- O caminho legítimo segue livre: a edge `reativacao-divida-antiga` grava 'nova_venda'
-- COM cotacao_id (dívida antiga de uma cotação de reativação do consultor).

create or replace function public.fn_reativacao_60d_sem_consultor(
  p_tipo_entrada text, p_cotacao_id uuid, p_is_teste boolean)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select lower(btrim(coalesce(p_tipo_entrada, ''))) = 'nova_venda'
     and p_cotacao_id is null
     and not coalesce(p_is_teste, false);
$function$;

create or replace function public.fn_guard_reativacao_60d_so_consultor()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if public.fn_reativacao_60d_sem_consultor(new.tipo_entrada, new.cotacao_id, new.is_teste)
     and (tg_op = 'INSERT'
          or not public.fn_reativacao_60d_sem_consultor(old.tipo_entrada, old.cotacao_id, old.is_teste)) then
    raise exception using
      errcode = 'P0001',
      message = 'Reativação acima de 60 dias é venda do consultor: não é feita pela revistoria. '
                || 'Encaminhe o associado para um consultor abrir uma cotação de reativação.',
      hint = 'reativacao_60d_exige_cotacao_consultor';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_reativacao_60d_so_consultor on public.reativacao_negociacoes;
create trigger trg_reativacao_60d_so_consultor
  before insert or update of tipo_entrada, cotacao_id, is_teste on public.reativacao_negociacoes
  for each row execute function public.fn_guard_reativacao_60d_so_consultor();

comment on trigger trg_reativacao_60d_so_consultor on public.reativacao_negociacoes is
  'Reativação > 60 dias é venda do consultor (cotação de reativação). A revistoria do Relacionamento não abre nova_venda sem cotação.';
revoke all on function public.fn_guard_reativacao_60d_so_consultor() from public, anon, authenticated;
