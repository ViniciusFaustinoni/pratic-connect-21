

## Fase 4 — Medir consumo real e decidir upgrade

### Situação atual (já apurada)

Tentei rodar `analytics_query` agora e o resultado é claro:
- **edge_logs últimas 24h**: apenas 6 registros
- **edge_logs últimos 7 dias**: apenas 6 registros
- **auth_logs**: vazio
- **postgres_logs**: vazio

Ou seja, **os logs históricos do Supabase estão indisponíveis no momento** (efeito direto da pane recente + retenção curta do plano atual). Não dá para medir top tabelas/endpoints retroativamente.

Em compensação, a auditoria estática do código mostra o gargalo restante:
- **410 ocorrências de `refetchInterval` em 53 arquivos**
- Polls ainda agressivos: `CardDespachoReboque` 10s, `BadgeDespachoStatus` 15s, dezenas de hooks em 30s
- Apenas alguns hooks já têm `refetchIntervalInBackground: false` (Fase 2)

### Estratégia da Fase 4

Já que os logs do Supabase não cobrem retroativo, a Fase 4 vai funcionar em duas frentes:

**A) Coleta contínua via instrumentação client-side (telemetria leve)**
**B) Auditoria final de polls restantes para eliminar excessos antes de pagar plano**

### Mudanças

#### 1. Instrumentação client-side de uso do Supabase
Criar `src/lib/supabaseTelemetry.ts`:
- Wrapper que conta chamadas por endpoint REST, por canal Realtime, por chamada Auth, agregando localmente em janelas de 1 min.
- Envia agregado para tabela `client_telemetry` no Supabase a cada 5 min (1 insert por sessão por janela — custo desprezível).
- Inclui: `path`, `method`, `count`, `avg_duration_ms`, `error_count`, `user_id`, `session_id`, `route`.
- Plugar no `src/integrations/supabase/client.ts` via `fetch` interceptor já existente (apenas estender o `fetchWithTimeout`).

Tabela nova:
```sql
client_telemetry (
  id uuid pk,
  user_id uuid,
  session_id text,
  route text,
  endpoint text,
  method text,
  status_bucket text,  -- 2xx/4xx/5xx/timeout
  count int,
  avg_ms int,
  window_start timestamptz,
  created_at timestamptz default now()
)
```
Com RLS: insert permitido para qualquer authenticated; select apenas para `diretor`/`admin`.

#### 2. Página de análise `/admin/telemetria`
Visível só para diretor/admin. Mostra:
- Top 20 endpoints por volume (24h / 7d)
- Distribuição por rota da app (qual tela mais consome)
- Erros 5xx/timeout por endpoint
- Comparação polling vs realtime (canais ativos)
- Recomendações automáticas ("endpoint X tem 12k chamadas/dia — considere aumentar staleTime")

Reaproveita componentes de gráfico existentes do projeto.

#### 3. Auditoria final de polls (corte cirúrgico)
Tabela de ações concretas:

| Arquivo | Hoje | Ação |
|---|---|---|
| `CardDespachoReboque.tsx` | 10s | manter só durante `aguardando_aceites`, desligar nos demais estados |
| `BadgeDespachoStatus.tsx` | 15s | aumentar para 30s |
| `useWhatsAppStatus.ts` | 30s | aumentar para 120s |
| `AlertasMonitoramento.tsx` (contagem) | 30s | aumentar para 60s |
| `useDocumentos.ts` (contagem) | 30s | aumentar para 90s |
| `useJornadaTrabalho.ts` | 30s | manter (já tem realtime fallback documentado) |
| `useMyData.ts` (rastreador/posição) | 30s | aumentar para 60s + `refetchIntervalInBackground:false` |
| `useAprovacaoMonitoramento.ts` | 30s | 60s |
| `useVistoriasPrestadoresDashboard.ts` | 30s | 90s |
| `useMovimentacoes.ts` | 30s | 60s |
| `useAcionamentosRouboFurtoPage.ts` | 30s | 60s |
| `usePrestadoresAtivosMapa.ts` | 30s | 60s |
| `AcompanharChamado.tsx` (associado) | 30s | 60s + `enabled` só com aba visível |
| `TrackingAssistencia.tsx` (público) | 30s | 60s |
| `useAppAssociado.ts` (assistência) | 30s | 60s |

Regra geral: adicionar `refetchIntervalInBackground: false` em **todos** os polls restantes que ainda não têm.

#### 4. Decisão sobre upgrade do plano
Após 7 dias de telemetria coletada via item #1/#2, a página `/admin/telemetria` vai mostrar números objetivos. Critério de decisão:

- Se **endpoint mais quente < 50k req/dia** e **erros 5xx < 0.5%** → **plano atual é suficiente**, manter.
- Se **algum endpoint > 100k req/dia mesmo após cortes** ou **timeouts persistentes** → **justifica upgrade** (Pro/Team).
- Se concorrência simultânea > 60 conexões frequente → **upgrade para Compute add-on** (não plano).

Esse critério vai estar documentado na própria página de telemetria.

### Arquivos editados/criados
- **novo**: `src/lib/supabaseTelemetry.ts`
- **novo**: migration `client_telemetry` + RLS + índices
- **novo**: `src/pages/admin/Telemetria.tsx` + rota
- `src/integrations/supabase/client.ts` — plugar telemetria no fetch wrapper
- `src/App.tsx` (ou roteador) — registrar rota `/admin/telemetria`
- 14 hooks/componentes da tabela acima — ajustar `refetchInterval` e `refetchIntervalInBackground`

### Critérios de aceitação
1. Telemetria começa a popular `client_telemetry` assim que usuários logam.
2. Página `/admin/telemetria` exibe top endpoints, erros e recomendações.
3. Nenhum poll < 30s permanece fora dos casos operacionais críticos justificados.
4. Todos os polls restantes têm `refetchIntervalInBackground: false`.
5. Após 7 dias, decisão sobre upgrade pode ser tomada com dados reais visíveis na própria UI.

### Fora de escopo
- Mover canais realtime para montagem por rota (continua para uma futura Fase 5 se a telemetria mostrar necessidade).
- Otimização de queries pesadas individuais (será guiada pelos dados da telemetria).

