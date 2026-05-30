# ERRO 14 — Observabilidade da integração SGA Hinova

## Diagnóstico — o que já existe

A tela canônica `/configuracoes/integracoes/sga-hinova` (`IntegracaoSGAHinova.tsx`) já cobre quase tudo o que o item 14 pede:

- **Fila** (`sga_sync_queue`) com filtros `pendente / falha / falha_permanente` e contadores.
- **Logs** (`sga_sync_logs`) — últimas execuções com `action / status / erro`.
- **Pendentes** — veículos `ativo` ainda `sincronizado_hinova=false`.
- **Health Check** (`IntegracaoHealthPanel` + `sga_health_checks`) com Online/Offline, tempo de resposta, uptime % e histórico das últimas 20 verificações.
- **Alerta automático**: `cron-sga-health-check` já notifica diretores quando `!conexao_ok` ou `fila_falhas > 5`, com link para a tela.

Memória `mem://infrastructure/integrations/sga-sync-queue-canonical` confirma que essa tela é a fonte da verdade — nenhum dashboard paralelo deve ser criado.

## O que falta (e justifica a correção)

1. **Taxa de sucesso por tipo de operação** — `sga_sync_logs.action` é o eixo natural para detectar regressão por endpoint. Hoje só vemos a lista crua de logs.
2. **Alerta cego à degradação silenciosa** — se a API responde 200 mas operações começam a falhar, a conexão segue OK e a fila pode ficar < 5 falhas; o alerta atual não dispara.

## Escopo da correção

Mudança puramente de observabilidade — sem nova tela e sem nova edge function.

### 1. Agregação no banco (SQL, não client-side)

Nova função SQL `public.sga_success_rate_by_action(janela_horas int)` (SECURITY DEFINER, `SET search_path = public`), retornando uma linha por `action`:

```sql
CREATE OR REPLACE FUNCTION public.sga_success_rate_by_action(janela_horas int DEFAULT 24)
RETURNS TABLE (
  action text,
  total bigint,
  ok bigint,
  falha bigint,
  taxa_sucesso numeric,
  duracao_media_ms numeric,
  ultimo_erro text,
  ultimo_erro_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    l.action,
    COUNT(*) FILTER (WHERE l.status <> 'skipped')            AS total,
    COUNT(*) FILTER (WHERE l.status = 'ok')                  AS ok,
    COUNT(*) FILTER (WHERE l.status NOT IN ('ok','skipped')) AS falha,
    CASE WHEN COUNT(*) FILTER (WHERE l.status <> 'skipped') = 0 THEN NULL
         ELSE ROUND(
           COUNT(*) FILTER (WHERE l.status = 'ok')::numeric
           / NULLIF(COUNT(*) FILTER (WHERE l.status <> 'skipped'), 0),
         4) END                                              AS taxa_sucesso,
    ROUND(AVG(l.duracao_ms) FILTER (WHERE l.status <> 'skipped'), 0) AS duracao_media_ms,
    (ARRAY_AGG(l.error_message ORDER BY l.created_at DESC)
       FILTER (WHERE l.status NOT IN ('ok','skipped')))[1]   AS ultimo_erro,
    MAX(l.created_at) FILTER (WHERE l.status NOT IN ('ok','skipped')) AS ultimo_erro_em
  FROM   public.sga_sync_logs l
  WHERE  l.created_at >= now() - make_interval(hours => janela_horas)
  GROUP  BY l.action
  ORDER  BY taxa_sucesso ASC NULLS LAST, total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.sga_success_rate_by_action(int) TO authenticated, service_role;
```

`skipped` fica fora tanto do numerador quanto do denominador. Linhas sem `ok|skipped` (ex.: `falha`, `erro`, `timeout`) contam como falha.

### 2. Aba "Visão Geral" em `IntegracaoSGAHinova.tsx`

- Primeira aba da `TabsList`.
- Toggle de janela: **24h** / **7 dias** (passa `janela_horas` para a RPC).
- Novo hook `useSGASuccessRateByAction(janelaHoras)` chama `supabase.rpc('sga_success_rate_by_action', { janela_horas: janelaHoras })`.
- Renderiza um grid de cards (um por `action`) ordenado pela própria RPC (taxa ascendente).
- Cada card linka para a aba **Logs** já filtrada por aquela `action` (adicionar filtro por `action` na aba de logs).

### 3. Gatilho de alerta por taxa de erro (cron-sga-health-check)

Em `supabase/functions/cron-sga-health-check/index.ts`, antes do INSERT em `sga_health_checks`:

- Chamar `sga_success_rate_by_action(24)`, agregar globalmente (somatório de `ok` e `total` excluindo `skipped`) e calcular `taxa_global_24h = sum(ok) / sum(total)`.
- Persistir `taxa_sucesso_24h` e `total_operacoes_24h` em `sga_health_checks` (migração leve: 2 colunas nullable).
- Estender `hasIssues`: dispara também quando `total_operacoes_24h >= 20` E `taxa_sucesso_24h < 0.85`.
- Mensagem inclui a taxa: `⚠️ SGA Hinova: taxa de sucesso caiu para 82% nas últimas 24h (45 operações).`

### 4. Migração mínima

```sql
ALTER TABLE public.sga_health_checks
  ADD COLUMN IF NOT EXISTS taxa_sucesso_24h    numeric(5,4),
  ADD COLUMN IF NOT EXISTS total_operacoes_24h integer;

-- + função sga_success_rate_by_action acima
```

Sem novas tabelas e sem alteração de RLS.

## Fora de escopo

- Refatorar as 65 edges para reduzir o acoplamento ao SGA — reconhecido como problema estrutural sem solução simples.
- Alertas por canal externo (Slack/e-mail) — depende de infra que o projeto ainda não tem.
- Dashboard separado fora de `Integrações › SGA Hinova` (proibido pela memória `sga-sync-queue-canonical`).

## Arquivos tocados

- `supabase/migrations/<timestamp>_sga_observabilidade.sql` — 2 colunas em `sga_health_checks` + função `sga_success_rate_by_action`.
- `supabase/functions/cron-sga-health-check/index.ts` — usa RPC, persiste taxa, novo trigger de alerta (85%).
- `src/hooks/useSGAHealthCheck.ts` — tipo `SGAHealthCheck` ganha as 2 colunas; novo hook `useSGASuccessRateByAction`.
- `src/pages/configuracoes/IntegracaoSGAHinova.tsx` — nova aba `Visão Geral` + filtro por `action` na aba Logs.
- `src/components/integracoes/IntegracaoHealthPanel.tsx` — badge da taxa 24h.
