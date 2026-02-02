
# Plano: Confirmação Matinal de Vistorias via WhatsApp

## Resumo do Pedido

O diretor solicitou um novo fluxo para confirmação de vistorias:
1. **Disparo às 7h** - Todos os associados com vistoria marcada para o dia recebem uma mensagem
2. **IA processa resposta** - Cliente pode confirmar ou reagendar
3. **Atribuição automática condicionada** - O vistoriador só é atribuído APÓS a confirmação via WhatsApp

---

## Situação Atual

### O que já existe:
- `confirmar-agendamento-cron`: Dispara confirmações ~1h antes do serviço
- `whatsapp-webhook`: Processa respostas (confirmação/reagendamento) com IA
- `confirmacoes_agendamento`: Tabela para rastrear confirmações
- `atribuir-proxima-tarefa`: Atribui serviços a vistoriadores (sem verificar confirmação)

### Problemas:
1. O disparo atual é ~1h antes → muito tarde para reorganizar a rota
2. A atribuição automática ignora se o cliente confirmou ou não
3. Não há bloqueio de atribuição para serviços não confirmados

---

## Solução Proposta

### 1. Nova Edge Function: `confirmar-vistorias-manha-cron`

Executa às **7h (horário de Brasília)** e envia mensagem para TODOS os clientes com vistoria agendada para o dia.

```text
Bom dia, *{primeiro_nome}*! ☀️

Lembramos que sua *vistoria veicular* está agendada para *HOJE*.

📅 Data: {data_formatada}
🕐 Horário: {hora_agendada}
📍 Local: {endereco}

Por favor, confirme sua disponibilidade:
✅ Responda *SIM* para confirmar
📅 Ou informe se precisa *reagendar*

Aguardamos sua confirmação!
PRATIC Proteção Veicular 🚗
```

### 2. Novo Status de Confirmação

Adicionar um novo valor possível para `confirmacao_whatsapp`:
- `aguardando_confirmacao_manha` → Mensagem das 7h enviada, aguardando resposta
- `confirmada` → Cliente confirmou (existente)
- `reagendado` → Cliente reagendou (existente)
- `nao_respondeu` → Deadline atingido sem resposta

### 3. Modificar Atribuição Automática

Alterar `atribuir-proxima-tarefa` e `cron-atribuir-tarefas` para:

- **Filtrar APENAS serviços confirmados** via WhatsApp
- OU serviços onde `confirmacao_whatsapp IS NULL` (não entrou no fluxo de confirmação)
- OU serviços com `permite_encaixe = true` (encaixes podem ser atribuídos livremente)

```sql
-- Condição adicional para buscar serviços:
AND (
  confirmacao_whatsapp = 'confirmada'          -- Cliente confirmou
  OR confirmacao_whatsapp IS NULL               -- Não entrou no fluxo (legado)
  OR permite_encaixe = true                     -- Encaixes podem ser atribuídos
)
```

### 4. Deadline de Confirmação

Se o cliente não responder até **1h antes do horário agendado**:
- Marcar como `nao_respondeu`
- Enviar notificação ao diretor
- NÃO atribuir automaticamente (vistoriador pode tentar contato manual)

---

## Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                     6:00 - NOITE ANTERIOR                       │
├─────────────────────────────────────────────────────────────────┤
│  Cliente agenda vistoria para o dia seguinte                    │
│  → Serviço criado com status 'agendada'                        │
│  → confirmacao_whatsapp = NULL                                  │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     7:00 - CRON MATINAL                         │
├─────────────────────────────────────────────────────────────────┤
│  confirmar-vistorias-manha-cron executa                         │
│  → Busca todas vistorias do dia (status agendada)              │
│  → Envia WhatsApp para cada cliente                            │
│  → Marca confirmacao_whatsapp = 'aguardando_confirmacao_manha' │
│  → Cria registro em confirmacoes_agendamento                   │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     7:00 - 9:00 - RESPOSTAS                     │
├─────────────────────────────────────────────────────────────────┤
│  Cliente responde via WhatsApp:                                 │
│                                                                 │
│  SIM → whatsapp-webhook processa                               │
│      → confirmacao_whatsapp = 'confirmada'                     │
│      → LIBERA para atribuição automática                       │
│                                                                 │
│  REAGENDAR → Inicia fluxo de reagendamento (já existe)         │
│            → Cria novo serviço, cancela o original             │
│                                                                 │
│  NÃO RESPONDE → Permanece como 'aguardando_confirmacao_manha'  │
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

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/confirmar-vistorias-manha-cron/index.ts` | **CRIAR** | Nova Edge Function para disparo às 7h |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | **MODIFICAR** | Adicionar filtro de confirmação |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | **MODIFICAR** | Adicionar filtro de confirmação |
| `supabase/functions/whatsapp-webhook/index.ts` | **MODIFICAR** | Aceitar status 'aguardando_confirmacao_manha' |
| `supabase/config.toml` | **MODIFICAR** | Adicionar nova função |

---

## CRON Job no Postgres

Criar um job que execute às 7h de Brasília (10h UTC):

```sql
SELECT cron.schedule(
  'confirmar-vistorias-manha',
  '0 10 * * *',  -- 7h Brasília = 10h UTC
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-vistorias-manha-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer {ANON_KEY}',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Regras de Negócio Adicionais

1. **Sábados**: Disparo às 8h (horário diferenciado)
2. **Domingos**: Não há vistorias (já bloqueado no calendário)
3. **Feriados**: Considerar implementação futura
4. **Timeout**: Se cliente não responder em 2h após o disparo, notificar diretor
5. **Exceção**: Serviços criados no mesmo dia (após 7h) não passam pelo fluxo matinal

---

## Mensagem de Confirmação (Template)

```text
Bom dia, *{nome}*! ☀️

Lembramos que sua *{tipo_servico}* está agendada para *HOJE*:

📅 {data_formatada}
🕐 {hora_agendada}
📍 {endereco}

Por favor, confirme:
✅ *SIM* - Estou confirmado
📅 *REAGENDAR* - Preciso de outro dia

Aguardamos! 🚗
*PRATIC Proteção Veicular*
```

---

## Resumo das Alterações

1. **Nova função CRON às 7h** para disparar confirmações matinais
2. **Novo status** `aguardando_confirmacao_manha` no campo `confirmacao_whatsapp`
3. **Filtro na atribuição** para só atribuir serviços confirmados
4. **Webhook atualizado** para aceitar respostas do disparo matinal
5. **Job no pg_cron** para executar a função diariamente
