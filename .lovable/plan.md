

# Painel de Monitoramento e Health Check do SGA Hinova

## Contexto

Hoje, erros de sincronização com o SGA Hinova só são descobertos quando alguém tenta enviar manualmente ou quando um admin olha logs no Supabase. Não existe uma tela dedicada para visualizar a fila de erros, reprocessar falhas ou verificar automaticamente a saúde da integração.

## O que será criado

### 1. Nova página: `/configuracoes/integracoes/sga-hinova`

Uma sub-página dentro de Integrações (mesmo padrão de WhatsApp, API Keys, Fontes de Leads) com as seguintes seções:

**a) Status da Conexão** — Card mostrando se a API Hinova está acessível (usa o `action: 'test_connection'` que já existe na edge function). Botão "Testar agora".

**b) Fila de Sincronização** — Tabela com os itens da `sga_sync_queue`, filtráveis por status (`pendente`, `processando`, `falha_permanente`). Para cada item: nome do associado, placa do veículo, etapa onde parou, número de tentativas, último erro, e botões de ação:
- **Reprocessar** — reseta o item para `pendente` e `tentativas = 0`
- **Descartar** — marca como `falha_permanente` (para itens irrecuperáveis)

**c) Logs Recentes** — Últimos 50 registros de `sga_sync_logs` com filtro por status (sucesso/erro) e busca por placa/nome.

**d) Veículos Pendentes** — Lista de veículos com `status = 'ativo'` e `sincronizado_hinova = false`, que nunca foram enviados. Botão para enviar em lote ou individualmente.

### 2. Edge Function: `cron-sga-health-check`

Um cron job que roda **3x ao dia** (8h, 13h, 18h) e:
- Testa a conexão com a API Hinova (autenticação)
- Conta quantos itens estão na fila com erro
- Conta quantos veículos ativos não foram sincronizados
- Grava o resultado em uma tabela `sga_health_checks`
- Se a conexão falhar ou houver muitos erros (>5 na fila), envia uma notificação (insere em `notificacoes` para os admins)

### 3. Tabela `sga_health_checks`

```sql
create table public.sga_health_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  conexao_ok boolean not null,
  tempo_resposta_ms integer,
  fila_pendentes integer default 0,
  fila_falhas integer default 0,
  veiculos_nao_sincronizados integer default 0,
  erro_mensagem text
);
```

### 4. Integração no card do SGA Hinova na página de Integrações

O card existente do SGA Hinova (`id: 'hinova'`) passa a ter `href: '/configuracoes/integracoes/sga-hinova'` ao invés de abrir o sheet de configuração. O sheet de credenciais será acessível de dentro da nova página.

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `src/pages/configuracoes/IntegracaoSGAHinova.tsx` | **Criar** — página completa com as 4 seções |
| `src/hooks/useSGAHealthCheck.ts` | **Criar** — hook para buscar health checks e fila |
| `supabase/functions/cron-sga-health-check/index.ts` | **Criar** — edge function do health check |
| `src/pages/configuracoes/Integracoes.tsx` | **Modificar** — mudar card Hinova para `href` |
| `src/pages/configuracoes/index.tsx` | **Modificar** — exportar nova página |
| `src/App.tsx` | **Modificar** — adicionar rota |
| Migration | **Criar** — tabela `sga_health_checks` |
| SQL insert (cron) | Agendar cron job 3x/dia |

## Detalhes Técnicos

- A página reutiliza o `ConfigurarIntegracaoSheet` existente para editar credenciais
- A tabela de fila faz JOIN com `associados(nome)` e `veiculos(placa)` para exibir informações legíveis
- O reprocessamento individual chama `supabase.from('sga_sync_queue').update({ status: 'pendente', tentativas: 0, proximo_reenvio_em: now() })`
- O health check usa o mesmo `sga-hinova-sync` com `action: 'test_connection'`
- Cron schedule: `0 8,13,18 * * *` (3x ao dia)

