create table public.cotacao_failure_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  vendedor_nome text,
  contexto text not null,
  codigo text not null,
  mensagem text,
  detalhes text,
  coluna text,
  payload_resumo jsonb,
  user_agent text,
  rota text,
  created_at timestamptz not null default now()
);

create index idx_cotacao_failure_metrics_created_at
  on public.cotacao_failure_metrics (created_at desc);
create index idx_cotacao_failure_metrics_codigo_created_at
  on public.cotacao_failure_metrics (codigo, created_at desc);
create index idx_cotacao_failure_metrics_user_created_at
  on public.cotacao_failure_metrics (user_id, created_at desc);

alter table public.cotacao_failure_metrics enable row level security;

create policy "Auth pode registrar próprias falhas"
on public.cotacao_failure_metrics
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Anon pode registrar falhas anônimas"
on public.cotacao_failure_metrics
for insert
to anon
with check (user_id is null);

create policy "Gestores leem métricas de falha"
on public.cotacao_failure_metrics
for select
to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'admin_master'::app_role)
  or has_role(auth.uid(), 'diretor'::app_role)
  or has_role(auth.uid(), 'gerente_comercial'::app_role)
  or has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
);

create or replace view public.vw_cotacao_failure_stats
with (security_invoker = true) as
with base as (
  select contexto, codigo, user_id, created_at
  from public.cotacao_failure_metrics
  where created_at >= now() - interval '30 days'
)
select
  contexto,
  codigo,
  count(*) filter (where created_at >= now() - interval '24 hours')::bigint as total_24h,
  count(*) filter (where created_at >= now() - interval '7 days')::bigint as total_7d,
  count(*)::bigint as total_30d,
  count(distinct user_id) filter (where created_at >= now() - interval '24 hours')::bigint as users_24h,
  count(distinct user_id) filter (where created_at >= now() - interval '7 days')::bigint as users_7d,
  count(distinct user_id)::bigint as users_30d,
  max(created_at) as last_seen
from base
group by contexto, codigo;