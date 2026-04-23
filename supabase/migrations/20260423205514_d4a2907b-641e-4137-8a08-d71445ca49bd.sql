create table if not exists public.comissoes_pagamento_itens (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.comissoes_pagamentos(id) on delete cascade,
  comissao_id uuid not null references public.comissoes(id) on delete restrict,
  vendedor_id uuid not null,
  valor_pago numeric not null default 0,
  status_anterior text not null,
  created_at timestamp with time zone not null default now(),
  constraint comissoes_pagamento_itens_comissao_id_key unique (comissao_id)
);

alter table public.comissoes_pagamento_itens enable row level security;

create index if not exists idx_comissoes_pagamento_itens_pagamento_id on public.comissoes_pagamento_itens(pagamento_id);
create index if not exists idx_comissoes_pagamento_itens_comissao_id on public.comissoes_pagamento_itens(comissao_id);
create index if not exists idx_comissoes_pagamento_itens_vendedor_id on public.comissoes_pagamento_itens(vendedor_id);
create index if not exists idx_comissoes_pagamento_itens_created_at on public.comissoes_pagamento_itens(created_at desc);

create policy "Usuários podem ver itens de pagamentos de comissões"
on public.comissoes_pagamento_itens
for select
using (
  vendedor_id = auth.uid()
  or public.has_role(auth.uid(), 'diretor')
  or public.has_role(auth.uid(), 'admin_master')
  or public.has_role(auth.uid(), 'desenvolvedor')
  or public.has_role(auth.uid(), 'gerente_comercial')
);

create policy "Diretoria pode inserir itens de pagamentos de comissões"
on public.comissoes_pagamento_itens
for insert
with check (
  public.has_role(auth.uid(), 'diretor')
  or public.has_role(auth.uid(), 'admin_master')
  or public.has_role(auth.uid(), 'desenvolvedor')
);

create or replace function public.fn_marcar_comissao_paga(p_comissao_id uuid)
returns table (pagamento_id uuid, comissao_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comissao public.comissoes%rowtype;
  v_pagamento_id uuid;
begin
  if not (
    public.has_role(auth.uid(), 'diretor')
    or public.has_role(auth.uid(), 'admin_master')
    or public.has_role(auth.uid(), 'desenvolvedor')
  ) then
    raise exception 'Sem permissão para registrar pagamento de comissão';
  end if;

  select * into v_comissao
  from public.comissoes
  where id = p_comissao_id
  for update;

  if not found then
    raise exception 'Comissão não encontrada';
  end if;

  if exists (select 1 from public.comissoes_pagamento_itens where comissoes_pagamento_itens.comissao_id = p_comissao_id) then
    raise exception 'Esta comissão já possui lançamento de pagamento';
  end if;

  if v_comissao.status = 'paga' then
    raise exception 'Esta comissão já está marcada como paga';
  end if;

  insert into public.comissoes_pagamentos (
    vendedor_id,
    mes_referencia,
    ano_referencia,
    valor_total,
    quantidade_comissoes,
    data_pagamento,
    observacoes
  ) values (
    v_comissao.vendedor_id,
    v_comissao.mes_referencia,
    v_comissao.ano_referencia,
    coalesce(v_comissao.valor_total, v_comissao.valor_comissao, 0),
    1,
    current_date,
    'Pagamento individual da comissão ' || v_comissao.id::text
  ) returning id into v_pagamento_id;

  insert into public.comissoes_pagamento_itens (
    pagamento_id,
    comissao_id,
    vendedor_id,
    valor_pago,
    status_anterior
  ) values (
    v_pagamento_id,
    v_comissao.id,
    v_comissao.vendedor_id,
    coalesce(v_comissao.valor_total, v_comissao.valor_comissao, 0),
    v_comissao.status
  );

  update public.comissoes
  set status = 'paga',
      pago_em = now(),
      updated_at = now()
  where id = v_comissao.id;

  pagamento_id := v_pagamento_id;
  comissao_id := v_comissao.id;
  return next;
end;
$$;

grant execute on function public.fn_marcar_comissao_paga(uuid) to authenticated;