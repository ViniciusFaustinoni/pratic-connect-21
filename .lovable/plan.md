
# Plano: Confirmação Matinal de Vistorias via WhatsApp

## ✅ STATUS: IMPLEMENTADO

---

## Resumo das Alterações Realizadas

### 1. Nova Edge Function: `confirmar-vistorias-manha-cron`
**Arquivo:** `supabase/functions/confirmar-vistorias-manha-cron/index.ts`

- Busca todos os serviços do dia com status 'agendada' ou 'pendente'
- Envia mensagem de confirmação via WhatsApp
- Marca `confirmacao_whatsapp = 'aguardando_confirmacao_manha'`
- Cria registro em `confirmacoes_agendamento`

### 2. Filtro de Confirmação na Atribuição
**Arquivos modificados:**
- `supabase/functions/atribuir-proxima-tarefa/index.ts`
- `supabase/functions/cron-atribuir-tarefas/index.ts`

Adicionado filtro para só atribuir serviços:
- Com `confirmacao_whatsapp = 'confirmada'` (cliente confirmou)
- OU `confirmacao_whatsapp IS NULL` (não entrou no fluxo)
- OU `permite_encaixe = true` (encaixes)

### 3. Webhook Atualizado
**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

- Atualizado para buscar serviços com status `aguardando_confirmacao_manha`
- Quando cliente responde "SIM", marca como `confirmada` e libera para atribuição

---

## 🔧 AÇÃO NECESSÁRIA: Criar CRON Job no Postgres

Para que o disparo às 7h funcione automaticamente, execute o SQL abaixo no Supabase:

```sql
-- Habilitar extensões necessárias (se ainda não estiverem)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar job para disparo às 7h de Brasília (10h UTC)
SELECT cron.schedule(
  'confirmar-vistorias-manha',
  '0 10 * * 1-6',  -- 10h UTC = 7h Brasília, Segunda a Sábado
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-vistorias-manha-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                     7:00 - CRON MATINAL                         │
├─────────────────────────────────────────────────────────────────┤
│  confirmar-vistorias-manha-cron executa                         │
│  → Busca todas vistorias do dia (status agendada)              │
│  → Envia WhatsApp para cada cliente                            │
│  → Marca confirmacao_whatsapp = 'aguardando_confirmacao_manha' │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     7:00+ - RESPOSTAS                           │
├─────────────────────────────────────────────────────────────────┤
│  Cliente responde via WhatsApp:                                 │
│                                                                 │
│  SIM → whatsapp-webhook processa                               │
│      → confirmacao_whatsapp = 'confirmada'                     │
│      → LIBERA para atribuição automática                       │
│                                                                 │
│  REAGENDAR → Inicia fluxo de reagendamento                     │
│                                                                 │
│  NÃO RESPONDE → Permanece 'aguardando_confirmacao_manha'       │
│               → BLOQUEADO para atribuição automática           │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     8:00+ - ATRIBUIÇÃO AUTOMÁTICA               │
├─────────────────────────────────────────────────────────────────┤
│  atribuir-proxima-tarefa roda a cada 5 min                     │
│                                                                 │
│  → Busca serviços com confirmacao_whatsapp = 'confirmada'      │
│  → Ordena por distância do vistoriador                         │
│  → Atribui ao vistoriador mais próximo                         │
│                                                                 │
│  Serviços 'aguardando_confirmacao_manha' são IGNORADOS         │
└─────────────────────────────────────────────────────────────────┘
```

