## Correção SGA Hinova — Sincronização Falhando — ✅ Implementado

### Causas Raiz Identificadas
1. **`return new Response(...)` dentro de `doBackgroundSync`** — Responses descartadas silenciosamente (background closure, não handler HTTP)
2. **Loop infinito de CPF duplicado** — CPF existe no Hinova mas busca retorna 404/406, gerando retry infinito
3. **Código associado inválido em cascata** — códigos de outra conta Hinova causam falha no cadastro de veículo

### Correções Aplicadas

1. **`sga-hinova-sync/index.ts`**:
   - Substituídos 11 `return new Response(...)` por `return;` dentro de `doBackgroundSync`
   - Adicionado **guard de loop infinito** no início do background: se 3+ falhas consecutivas de CPF duplicado, marca como `falha_permanente` e para de retentar

2. **`cron-sga-retry/index.ts`**:
   - Adicionada **detecção de loops** antes de reprocessar: se 5+ tentativas com mesmo padrão de erro (CPF duplicado, "não aceitável"), marca como `falha_permanente` e pula o item

---

## Painel de Monitoramento SGA Hinova — ✅ Implementado

### O que foi criado

1. **Página `/configuracoes/integracoes/sga-hinova`** com:
   - Status de conexão com API Hinova (teste em tempo real)
   - Fila de sincronização com filtros e ações (Reprocessar / Descartar)
   - Logs recentes dos últimos 50 registros
   - Veículos pendentes (ativos não sincronizados) com envio individual
   - Histórico de health checks

2. **Edge Function `cron-sga-health-check`**: Testa conexão, conta pendências e falhas, armazena resultado em `sga_health_checks`, notifica admins se houver problemas.

3. **Tabela `sga_health_checks`**: Armazena resultados dos health checks automáticos.

4. **Cron job**: Precisa ser agendado via SQL Editor do Supabase (3x ao dia: 8h, 13h, 18h).

---

## Health Check Universal para Todas as Integrações — ✅ Implementado

### O que foi criado

1. **Tabela `integracoes_health_checks`** (genérica):
   - Campos: `integracao`, `conexao_ok`, `tempo_resposta_ms`, `detalhes` (JSONB), `erro_mensagem`
   - Dados existentes do SGA migrados automaticamente
   - RLS: leitura para autenticados, escrita para service_role

2. **Edge Function `cron-integracoes-health-check`**:
   - Testa 8 integrações: ASAAS, WhatsApp, Autentique, SGA Hinova, Softruck, Rede Veículos, Email/Resend, OpenAI
   - Suporta teste individual (`{ integracao: "asaas" }`) ou todas de uma vez
   - Notifica admins (role `diretor`) se qualquer integração falhar
   - Grava resultado por integração na tabela genérica

3. **Componente `<IntegracaoHealthPanel />`** (reutilizável):
   - Props: `integracao` (slug) e `titulo` (opcional)
   - Exibe: status atual, tempo de resposta, taxa de sucesso, detalhes JSONB, histórico
   - Botão "Testar agora" invoca a edge function para a integração específica

4. **Hook `useIntegracaoHealthCheck(integracao)`**:
   - Busca histórico filtrado por integração
   - Mutation `testNow` para teste manual
   - Hook `useAllLatestHealthChecks()` para indicadores nos cards

5. **Integração nas páginas**:
   - `IntegracaoSGAHinova.tsx`: Tab "Health Check" usa `<IntegracaoHealthPanel integracao="hinova" />`
   - `IntegracaoWhatsApp.tsx`: Nova tab "Health" com `<IntegracaoHealthPanel integracao="whatsapp" />`
   - `Integracoes.tsx`: Bolinha colorida (verde/vermelha) com tooltip em cada card, mostrando último health check

6. **Cron job**: Deve ser agendado via SQL Editor (substitui o antigo):
   ```sql
   select cron.schedule(
     'integracoes-health-check-3x-dia',
     '0 8,13,18 * * *',
     $$ select net.http_post(
       url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-integracoes-health-check',
       headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
       body:='{}'::jsonb
     ) as request_id; $$
   );
   ```

### Arquivos criados/modificados
- `supabase/functions/cron-integracoes-health-check/index.ts` — Nova edge function universal
- `src/hooks/useIntegracaoHealthCheck.ts` — Hook genérico
- `src/components/integracoes/IntegracaoHealthPanel.tsx` — Componente reutilizável
- `src/pages/configuracoes/IntegracaoSGAHinova.tsx` — Tab Health usando componente genérico
- `src/pages/configuracoes/IntegracaoWhatsApp.tsx` — Nova tab Health
- `src/pages/configuracoes/Integracoes.tsx` — Indicadores de health nos cards
- `supabase/config.toml` — verify_jwt para nova function

---

## Correção Atribuição Automática — Geocode + Proteção de Coordenadas — ✅ Implementado

### Causas Raiz
1. Serviço criado sem coordenadas (Nominatim 429 rate limit) → `atribuir-proxima-tarefa` retornava `sem_tarefas`
2. `cron-atribuir-tarefas` atualizava `instalacoes` com colunas erradas (`latitude/longitude` em vez de `endereco_latitude/endereco_longitude`)
3. Triggers de sync sobrescreviam coordenadas válidas com `null`

### Correções Aplicadas

1. **`atribuir-proxima-tarefa/index.ts`**: Geocodificação on-the-fly para serviços sem coordenadas (Nominatim + fallback bairro/cidade), persistindo em `servicos`, `instalacoes` e `vistorias`

2. **`cron-atribuir-tarefas/index.ts`**: Corrigido nomes de colunas: `{ latitude, longitude }` → `{ endereco_latitude, endereco_longitude }` para updates em `instalacoes`. Adicionado log de erros em todos os updates.

3. **Migration SQL (triggers)**: `sync_instalacao_update_to_servicos` e `sync_vistoria_update_to_servicos` agora usam `COALESCE(NEW.endereco_latitude, servicos.latitude)` para nunca apagar coordenadas válidas.

4. **`geocode-endereco/index.ts`**: Retry automático em HTTP 429 (respeitando `Retry-After`), campo `reason` no retorno para monitoramento.
