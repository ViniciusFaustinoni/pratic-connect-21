

# Health Check Universal para Todas as Integrações

## Visão Geral

Criar um sistema genérico de health check que monitora automaticamente **todas** as integrações 3x ao dia, armazena o histórico, e disponibiliza um painel reutilizável em cada sub-página de integração. Novas integrações adicionadas no futuro precisarão apenas de uma entrada na configuração.

## Arquitetura

```text
┌─────────────────────────────────────┐
│  cron-integracoes-health-check      │  ← 3x/dia (8h, 13h, 18h)
│  Testa TODAS as integrações:        │
│  - ASAAS (API key test)             │
│  - WhatsApp (instância status)      │
│  - Autentique (API key test)        │
│  - SGA Hinova (login test)          │
│  - Softruck (auth test)             │
│  - Rede Veículos (auth test)        │
│  - Email/Resend (API key test)      │
│  - OpenAI (API key test)            │
│  Grava resultado por integração     │
│  Notifica admins se falhar          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  integracoes_health_checks          │
│  - integracao (enum/text)           │
│  - conexao_ok (bool)               │
│  - tempo_resposta_ms (int)          │
│  - detalhes (jsonb)                 │
│  - erro_mensagem (text)             │
│  - created_at                       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  <IntegracaoHealthPanel />          │  ← Componente reutilizável
│  - Status atual (Online/Offline)    │
│  - Botão "Testar agora"            │
│  - Histórico de health checks      │
│  - Alertas ativos                   │
│  Usado em cada sub-página           │
└─────────────────────────────────────┘
```

## O que será criado/modificado

### 1. Tabela `integracoes_health_checks` (nova, genérica)

Substitui a tabela `sga_health_checks` (que fica restrita ao SGA). Campos:
- `id`, `created_at`
- `integracao` (text): 'asaas', 'whatsapp', 'autentique', 'hinova', 'softruck', 'rede_veiculos', 'email', 'openai'
- `conexao_ok` (bool)
- `tempo_resposta_ms` (int)
- `detalhes` (jsonb) — dados específicos por integração (ex: fila_pendentes para SGA, instancia_status para WhatsApp)
- `erro_mensagem` (text)

Migra os dados existentes de `sga_health_checks` para a nova tabela.

### 2. Edge Function `cron-integracoes-health-check` (nova)

Substitui `cron-sga-health-check`. Testa cada integração:

| Integração | Como testa |
|---|---|
| ASAAS | Verifica se `ASAAS_API_KEY` existe e faz GET na API de status |
| WhatsApp | Verifica `EVOLUTION_API_KEY` + consulta `whatsapp_instancias` status |
| Autentique | Verifica se `AUTENTIQUE_API_KEY` existe |
| SGA Hinova | Login na API (já existente) + conta fila/falhas |
| Softruck | Verifica credenciais no banco + testa auth |
| Rede Veículos | Verifica credenciais no banco + testa auth |
| Email | Verifica se `RESEND_API_KEY` existe |
| OpenAI | Verifica se `OPENAI_API_KEY` existe |

Grava um registro por integração. Notifica admins se qualquer uma falhar.

### 3. Componente `<IntegracaoHealthPanel />` (novo, reutilizável)

Props: `integracao: string` (o slug). Exibe:
- Card de status atual (Online/Offline/Não testado)
- Tempo de resposta
- Botão "Testar agora" (invoca a edge function passando `integracao` específica)
- Tabela de histórico dos últimos 20 health checks
- Detalhes extras via `detalhes` jsonb

### 4. Hook `useIntegracaoHealthCheck(integracao: string)` (novo, genérico)

Substitui os dados de health do `useSGAHealthCheck` (que mantém as funções de fila/queue). Consulta `integracoes_health_checks` filtrado por integração.

### 5. Integrar o painel em cada sub-página

| Página | Alteração |
|---|---|
| `IntegracaoSGAHinova.tsx` | Substituir cards de conexão pelo `<IntegracaoHealthPanel integracao="hinova" />` |
| `IntegracaoWhatsApp.tsx` | Adicionar tab "Health Check" com `<IntegracaoHealthPanel integracao="whatsapp" />` |
| `Integracoes.tsx` (cards sem sub-página) | Adicionar tooltip/indicador do último health check no card |

### 6. Atualizar cron job

Substituir o cron `sga-health-check-3x-dia` pelo novo `integracoes-health-check-3x-dia` que chama a nova edge function.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | **Criar** tabela `integracoes_health_checks`, migrar dados |
| `supabase/functions/cron-integracoes-health-check/index.ts` | **Criar** — testa todas as integrações |
| `src/components/integracoes/IntegracaoHealthPanel.tsx` | **Criar** — componente reutilizável |
| `src/hooks/useIntegracaoHealthCheck.ts` | **Criar** — hook genérico |
| `src/pages/configuracoes/IntegracaoSGAHinova.tsx` | **Modificar** — usar componente genérico |
| `src/pages/configuracoes/IntegracaoWhatsApp.tsx` | **Modificar** — adicionar tab Health |
| `src/pages/configuracoes/Integracoes.tsx` | **Modificar** — mostrar último health check nos cards |
| `supabase/config.toml` | **Modificar** — adicionar nova function |

