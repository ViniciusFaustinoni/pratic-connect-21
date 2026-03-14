

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

### Arquivos criados/modificados
- `src/pages/configuracoes/IntegracaoSGAHinova.tsx` — Nova página
- `src/hooks/useSGAHealthCheck.ts` — Hook com queries e mutations
- `supabase/functions/cron-sga-health-check/index.ts` — Edge function
- `src/pages/configuracoes/Integracoes.tsx` — Card Hinova agora navega para sub-página
- `src/pages/configuracoes/index.tsx` — Export adicionado
- `src/App.tsx` — Rota adicionada
- `supabase/config.toml` — verify_jwt = false para a nova function
