
-- Tabela de histórico imutável de decisões
create table public.migracao_decisoes_historico (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid references solicitacoes_migracao(id) on delete cascade not null,
  decisao text not null check (decisao in ('aprovada', 'reprovada')),
  motivo text,
  analista_id uuid not null,
  analista_nome text,
  created_at timestamptz default now()
);

alter table public.migracao_decisoes_historico enable row level security;

-- RLS: authenticated can read
create policy "authenticated_read_historico"
on public.migracao_decisoes_historico
for select to authenticated using (true);

-- RLS: authenticated can insert
create policy "authenticated_insert_historico"
on public.migracao_decisoes_historico
for insert to authenticated with check (true);
