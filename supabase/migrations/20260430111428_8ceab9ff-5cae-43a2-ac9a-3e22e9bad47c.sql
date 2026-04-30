create table if not exists public.ai_provider_keys (
  provider text primary key check (provider in ('openai','anthropic')),
  api_key text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.ai_provider_keys enable row level security;

drop policy if exists "diretor_dev_can_manage_ai_keys" on public.ai_provider_keys;
create policy "diretor_dev_can_manage_ai_keys"
on public.ai_provider_keys
for all
to authenticated
using (public.has_role(auth.uid(),'diretor') or public.has_role(auth.uid(),'desenvolvedor'))
with check (public.has_role(auth.uid(),'diretor') or public.has_role(auth.uid(),'desenvolvedor'));

create or replace function public.ai_provider_keys_status()
returns table(provider text, configured boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.provider,
         exists(select 1 from public.ai_provider_keys k where k.provider = p.provider) as configured
  from (values ('openai'),('anthropic')) as p(provider);
$$;

grant execute on function public.ai_provider_keys_status() to authenticated;

create or replace function public.touch_ai_provider_keys()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_ai_provider_keys on public.ai_provider_keys;
create trigger trg_touch_ai_provider_keys
before update on public.ai_provider_keys
for each row execute function public.touch_ai_provider_keys();