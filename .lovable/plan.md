

## Métricas de falha do fluxo de criação de cotação

### Diagnóstico

Hoje `useCriarCotacao` lança erro e o `Cotador.tsx` apenas mostra um toast (com `descreverErroSupabase`) e dá `console.error`. Não temos:
- Persistência das falhas para análise temporal.
- Agregação por código (`42501`, `23502`, `23505`, timeout, network, validação local).
- Visibilidade para gestor monitorar a taxa de erro.

### Mudanças

**A. Nova tabela `cotacao_failure_metrics` (migration)**

```sql
create table public.cotacao_failure_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                 -- auth.uid() do solicitante (pode ser null se anon)
  vendedor_nome text,           -- snapshot do nome do profile p/ filtro fácil
  contexto text not null,       -- 'criar_cotacao' (extensível)
  codigo text not null,         -- '42501' | '23502' | '23505' | 'timeout' | 'network' | 'validacao_local' | 'outro'
  mensagem text,                -- e.message bruto (até 1000 chars)
  detalhes text,                -- e.details/hint (até 1000 chars)
  coluna text,                  -- coluna extraída (NOT NULL) quando disponível
  payload_resumo jsonb,         -- snapshot mínimo: plano_id, valor_fipe, lead_id, categoria, regiao
  user_agent text,
  rota text,                    -- window.location.pathname
  created_at timestamptz default now()
);

create index on public.cotacao_failure_metrics (created_at desc);
create index on public.cotacao_failure_metrics (codigo, created_at desc);
create index on public.cotacao_failure_metrics (user_id, created_at desc);

alter table public.cotacao_failure_metrics enable row level security;

-- INSERT: qualquer autenticado (próprio user_id) ou anon (user_id null)
create policy "Auth pode registrar próprias falhas"
on public.cotacao_failure_metrics for insert
to authenticated
with check (user_id = auth.uid());

create policy "Anon pode registrar falhas anônimas"
on public.cotacao_failure_metrics for insert
to anon
with check (user_id is null);

-- SELECT: só admin / gestor / monitoramento podem ler
create policy "Gestores leem métricas"
on public.cotacao_failure_metrics for select
to authenticated
using (
  has_role(auth.uid(), 'admin')
  or has_role(auth.uid(), 'diretor')
  or has_role(auth.uid(), 'gestor')
  or has_role(auth.uid(), 'coordenador_monitoramento')
);
```

**B. View agregada `vw_cotacao_failure_stats`** (24h, 7d, 30d) — agrupa por código com `count`, `last_seen`, `unique_users`.

**C. Hook `useRegistrarFalhaCotacao` + classificador**

- Novo arquivo `src/lib/failureMetrics.ts`:
  - `classificarErro(err): { codigo, coluna? }` — retorna chave estável (`'42501'`, `'23502'`, `'23505'`, `'timeout'`, `'network'`, `'validacao_local'`, `'outro'`).
  - `registrarFalhaCotacao({ contexto, erro, payload })` — faz `supabase.from('cotacao_failure_metrics').insert(...)`. Truncar strings, capturar `user_id` via `supabase.auth.getUser()`. Fire-and-forget (`.then().catch(swallow)`), nunca propaga erro pra UI.

**D. Instrumentação do `Cotador.tsx`**

- No `catch` do `criarCotacao.mutateAsync(...)` (linhas 924-928), antes do toast, chamar `registrarFalhaCotacao({ contexto: 'criar_cotacao', erro: error, payload: { plano_id, valor_fipe, lead_id, categoria_veiculo, regiao } })`. Sem await — não bloqueia UX.

**E. Painel de monitoramento (rota `/admin/monitoramento/erros-cotacao`)**

- Nova página `src/pages/admin/MonitoramentoErrosCotacao.tsx` + entrada no menu admin.
- Hook `useFailureStats(periodo: '24h'|'7d'|'30d')` que lê de `vw_cotacao_failure_stats`.
- UI:
  - 4 cards-resumo: total, % RLS, % NOT NULL, % duplicidade.
  - Tabela: código, descrição amigável, contagem, última ocorrência, usuários únicos.
  - Lista das 50 ocorrências mais recentes (timestamp, código, mensagem, vendedor, rota) — só leitura.
  - Filtro de período (24h padrão).
- Acesso restrito via guard `RequireRole(['admin','diretor','gestor','coordenador_monitoramento'])` (já existe pattern no projeto).

### Arquivos editados

- **Migration nova** — tabela `cotacao_failure_metrics`, índices, RLS, view agregada.
- **Novo** `src/lib/failureMetrics.ts` — classificador + registrador fire-and-forget.
- **Novo** `src/hooks/useFailureStats.ts` — leitura agregada.
- **Novo** `src/pages/admin/MonitoramentoErrosCotacao.tsx` — painel.
- `src/pages/vendas/Cotador.tsx` — `registrarFalhaCotacao` no catch.
- `src/App.tsx` (ou router equivalente) — registrar rota `/admin/monitoramento/erros-cotacao`.
- Menu admin (descobrir o arquivo: `src/components/layout/AdminSidebar.tsx` ou similar) — link para o painel.

### O que NÃO muda

- `descreverErroSupabase` e o toast no usuário — continuam idênticos.
- A RLS de `cotacoes` e a lógica de criação — intocadas.
- Outros fluxos (criação de leads, contratos, etc.) — fora de escopo. A tabela `cotacao_failure_metrics` é dedicada ao fluxo de cotação (campo `contexto` permite expandir depois sem migration).

### Riscos

- **Falha ao registrar** (RLS quebrada, rede caída): a função é fire-and-forget e nunca lança — pior caso, perdemos a métrica daquela falha (aceito).
- **PII em `mensagem`**: erros do Postgres não costumam ter dados sensíveis, mas trunco em 1000 chars e mantenho `payload_resumo` com IDs (não com nomes/CPF).
- **Volume**: em pior cenário (1k cotações/dia, 5% falha) ≈ 50 linhas/dia. Sem necessidade de retenção automática agora; se virar problema, adiciono job de purge >90d em outra tarefa.

### Fora de escopo (mencionado, não implementado)

- Alertas proativos (e-mail/WhatsApp quando taxa > X%) — pode ser próxima tarefa via cron Edge Function lendo `vw_cotacao_failure_stats`.
- Instrumentação de outros fluxos (leads, contratos) — mesma infra serve, mas só depois de validar este.

