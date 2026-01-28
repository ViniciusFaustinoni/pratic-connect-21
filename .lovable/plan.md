
# Plano: Sistema de Confirmacao de Agendamento via WhatsApp com IA

## Visao Geral

Implementar um sistema automatizado que:
1. 1 hora antes do horario agendado, envia mensagem WhatsApp para o cliente via Evolution API
2. IA processa a resposta do cliente (confirmacao ou reagendamento)
3. Atualiza status em tempo real no app do vistoriador e na area do cliente

---

## Arquitetura do Sistema

```text
+------------------+     +----------------------+     +-----------------+
|   CRON (1min)    | --> | confirmar-agendamento| --> | WhatsApp Client |
| (pg_cron ou ext) |     |    Edge Function     |     |    (Cliente)    |
+------------------+     +----------------------+     +-----------------+
                                                              |
                                                              v
                                                    +-----------------+
                                                    | whatsapp-webhook|
                                                    | (processa resp) |
                                                    +-----------------+
                                                              |
                         +------------------------------------+
                         |                                    |
                         v                                    v
              +-------------------+               +---------------------+
              | Confirmou         |               | Quer Reagendar      |
              | - Atualiza servico|               | - IA oferece opcoes |
              | - Notifica vist.  |               | - Cliente escolhe   |
              | - Push + Realtime |               | - Cria novo agend.  |
              +-------------------+               +---------------------+
                         |                                    |
                         v                                    v
              +-------------------+               +-------------------+
              | App Vistoriador   |               | Area do Cliente   |
              | (Realtime update) |               | (Realtime update) |
              +-------------------+               +-------------------+
```

---

## Banco de Dados

### Nova Tabela: `confirmacoes_agendamento`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| servico_id | uuid | FK -> servicos |
| instalacao_id | uuid | FK -> instalacoes (legacy) |
| telefone | text | Telefone do cliente |
| status | text | 'pendente', 'enviada', 'confirmada', 'reagendando', 'cancelada' |
| mensagem_enviada_em | timestamptz | Quando foi enviada a msg |
| resposta_recebida_em | timestamptz | Quando cliente respondeu |
| resposta_cliente | text | Texto da resposta |
| contexto_ia | jsonb | Contexto da conversa de reagendamento |
| novo_servico_id | uuid | Se reagendou, referencia ao novo |
| created_at | timestamptz | |

### Alteracao: Tabela `servicos`

Adicionar colunas:
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| confirmacao_whatsapp | text | 'pendente', 'confirmado', 'reagendado' |
| confirmado_via_whatsapp_em | timestamptz | Data/hora da confirmacao |

---

## Edge Functions

### 1. `confirmar-agendamento-cron` (Nova)

**Funcao:** Executada via pg_cron a cada minuto, busca servicos com horario 1h a frente

**Logica:**
```
1. Buscar servicos onde:
   - status IN ('agendada', 'pendente')
   - data_agendada = HOJE
   - hora_agendada entre NOW()+55min e NOW()+65min
   - confirmacao_whatsapp IS NULL ou = 'pendente'
   
2. Para cada servico:
   a. Buscar telefone do cliente (associado ou cotacao)
   b. Montar mensagem personalizada com IA
   c. Enviar via whatsapp-send-text
   d. Criar registro em confirmacoes_agendamento
   e. Atualizar servicos.confirmacao_whatsapp = 'enviada'
```

**Mensagem Exemplo:**
```
Ola! Aqui e a PRATIC. Confirmamos sua instalacao de rastreador
para HOJE as 10:00 no endereco [endereco].

Pode confirmar sua presenca?
- Responda SIM para confirmar
- Ou diga se precisa reagendar

Nosso tecnico [nome] esta a caminho!
```

### 2. `whatsapp-webhook` (Modificar)

**Adicionar nova logica antes do fluxo de associado:**

```typescript
// NOVO: Verificar se e resposta de confirmacao de agendamento
const confirmacaoPendente = await supabase
  .from('confirmacoes_agendamento')
  .select('*, servico:servicos(*)')
  .eq('telefone', telefone)
  .eq('status', 'enviada')
  .or('status.eq.reagendando')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (confirmacaoPendente) {
  return await processarRespostaConfirmacao(
    supabase, 
    confirmacaoPendente, 
    mensagemTexto,
    instancia
  );
}

// Se nao, continua fluxo normal de associado...
```

**Nova funcao `processarRespostaConfirmacao`:**

Usa IA para entender a resposta:
- Se confirmou: atualizar status, notificar vistoriador
- Se quer reagendar: iniciar fluxo de reagendamento com opcoes
- Se cancelou: marcar como cancelado

### 3. `notificar-vistoriador-confirmacao` (Nova)

**Funcao:** Envia push notification e atualiza realtime para o app do vistoriador

```typescript
// Enviar push notification
await supabase.functions.invoke('send-push-profissional', {
  body: {
    profissional_id: servico.profissional_id,
    notification: {
      title: 'Cliente Confirmou!',
      body: `${clienteNome} confirmou presenca para ${horario}`,
      tag: `confirmacao-${servico.id}`,
      data: { servico_id: servico.id, action: 'confirmacao' }
    }
  }
});
```

---

## Fluxo de Reagendamento com IA

### System Prompt para IA de Reagendamento

```
Voce e um assistente de reagendamento da PRATIC.

O cliente quer reagendar sua instalacao. Colete as seguintes informacoes:
1. Local: BASE (vem ate nos) ou CLIENTE (vamos ate voce)
2. Data: ofereca proximas 5 datas uteis disponiveis
3. Periodo: MANHA (08-12h) ou TARDE (14-18h)
4. Horario especifico (se desejar)

TOOLS disponiveis:
- get_datas_disponiveis: retorna proximas datas com vagas
- get_bases_disponiveis: retorna bases fisicas proximas
- criar_novo_agendamento: cria o novo agendamento
- cancelar_agendamento_anterior: cancela o atual

Ao finalizar, informe o novo horario e confirme.
```

### Tools para Reagendamento

| Tool | Descricao |
|------|-----------|
| `get_datas_disponiveis` | Retorna proximas 5 datas uteis com horarios |
| `get_horarios_disponiveis` | Horarios livres para uma data |
| `criar_novo_agendamento` | Cria servico e instalacao novos |
| `cancelar_agendamento_antigo` | Cancela o servico atual |
| `notificar_reagendamento` | Notifica vistoriador da mudanca |

---

## Frontend

### 1. App do Vistoriador (`TarefaAtualCard.tsx`)

Adicionar indicador visual de confirmacao:

```tsx
// Badge de confirmacao do cliente
{tarefa.confirmacao_whatsapp === 'confirmado' && (
  <Badge className="bg-green-500">
    <CheckCircle className="h-3 w-3 mr-1" />
    Cliente confirmou via WhatsApp
  </Badge>
)}
{tarefa.confirmacao_whatsapp === 'pendente' && (
  <Badge variant="outline" className="text-amber-500">
    <Clock className="h-3 w-3 mr-1" />
    Aguardando confirmacao
  </Badge>
)}
```

### 2. Area do Cliente (`AcompanhamentoProposta.tsx`)

Adicionar secao de confirmacao de agendamento:

```tsx
// Mostrar status da confirmacao
{instalacao && (
  <Card className="...">
    <CardContent>
      <h3>Seu Agendamento</h3>
      <p>{format(instalacao.data_agendada, 'dd/MM')} as {instalacao.hora_agendada}</p>
      
      {confirmacaoStatus === 'confirmado' && (
        <Badge className="bg-green-500">
          Voce confirmou sua presenca
        </Badge>
      )}
      
      {confirmacaoStatus === 'reagendando' && (
        <Alert>
          Estamos reagendando sua instalacao via WhatsApp.
          Verifique seu celular para escolher o novo horario.
        </Alert>
      )}
    </CardContent>
  </Card>
)}
```

### 3. Realtime Subscriptions

Adicionar subscription para tabela `confirmacoes_agendamento`:

```tsx
// Em AcompanhamentoProposta.tsx
.on(
  'postgres_changes',
  {
    event: '*',
    schema: 'public',
    table: 'confirmacoes_agendamento',
    filter: `servico_id=eq.${servicoId}`,
  },
  () => {
    queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta'] });
  }
)
```

---

## Cron Job (pg_cron)

Agendar execucao a cada minuto:

```sql
SELECT cron.schedule(
  'confirmar-agendamentos-whatsapp',
  '* * * * *', -- A cada minuto
  $$
  SELECT net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/confirmar-agendamento-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGc..."}'::jsonb
  );
  $$
);
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/confirmar-agendamento-cron/index.ts` | **Criar** | Cron que envia confirmacoes |
| `supabase/functions/whatsapp-webhook/index.ts` | Modificar | Adicionar logica de confirmacao |
| `src/hooks/useTarefaAtual.ts` | Modificar | Incluir campo confirmacao_whatsapp |
| `src/components/vistoriador/TarefaAtualCard.tsx` | Modificar | Badge de confirmacao |
| `src/pages/public/AcompanhamentoProposta.tsx` | Modificar | Status confirmacao + realtime |
| Migracao SQL | **Criar** | Tabela confirmacoes_agendamento + colunas |

---

## Sequencia de Implementacao

### Fase 1: Banco de Dados
1. Criar tabela `confirmacoes_agendamento`
2. Adicionar colunas em `servicos`
3. Habilitar realtime para nova tabela

### Fase 2: Edge Functions
4. Criar `confirmar-agendamento-cron`
5. Modificar `whatsapp-webhook` para processar respostas
6. Adicionar tools de reagendamento a IA

### Fase 3: Frontend
7. Atualizar `TarefaAtualCard` com badge de confirmacao
8. Atualizar `AcompanhamentoProposta` com status
9. Adicionar realtime subscriptions

### Fase 4: Cron Job
10. Configurar pg_cron para execucao automatica

---

## Consideracoes Tecnicas

### Timezone
- Todas as comparacoes de horario usarao timezone 'America/Sao_Paulo'
- Funcao `getHojeBrasilia()` ja existe em `src/lib/date-utils.ts`

### Idempotencia
- Verificar se confirmacao ja foi enviada antes de enviar novamente
- Flag `confirmacao_whatsapp` no servico previne duplicatas

### Fallback
- Se cliente nao responder em 30min, marcar como 'nao_respondeu'
- Vistoriador pode confirmar manualmente no app

### Push Notifications
- VAPID keys ja configuradas
- Usar edge function `send-push-profissional` existente

