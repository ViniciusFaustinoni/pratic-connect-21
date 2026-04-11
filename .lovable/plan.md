

## Plano: Lógica de Atribuição Automática com Confirmação por Tipo

### Contexto Atual
- `confirmar-vistorias-manha-cron` envia confirmação em 2 disparos: véspera (18h) e manhã (8h)
- `cron-atribuir-tarefas` só atribui serviços com `confirmacao_whatsapp = 'confirmada'` (normais) ou `NULL` (encaixes)
- `criar-instalacao-pos-pagamento` já dispara `cron-atribuir-tarefas` após criar serviço, mas não envia confirmação ao cliente para encaixes

### Regras Solicitadas

| Tipo | Confirmação WhatsApp (cliente) | Atribuição |
|---|---|---|
| **Encaixe** (`permite_encaixe=true`) | Enviada IMEDIATAMENTE na criação do serviço | Imediata (fila por proximidade) |
| **Normal** (`permite_encaixe=false`) | Enviada 1h ANTES do turno (7h manhã / 13h tarde) | Após confirmação do cliente |

### Alterações

**1. `supabase/functions/criar-instalacao-pos-pagamento/index.ts`**
- Após criar a instalação, se `permiteEncaixe=true`: enviar template de confirmação ao cliente imediatamente via `whatsapp-send-text` (template `confirmacao_agendamento_v1`)
- Criar registro em `confirmacoes_agendamento` com status `enviada`
- Manter o trigger de `cron-atribuir-tarefas` que já existe (encaixe com confirmação NULL já é aceito)

**2. `supabase/functions/confirmar-vistorias-manha-cron/index.ts`** (reescrever lógica)
- Substituir a lógica véspera/manhã por lógica baseada em turno:
  - **Disparo manhã (7h Brasília / 10h UTC)**: busca serviços de HOJE com `periodo = 'manha'` e `confirmacao_whatsapp IS NULL` e `permite_encaixe = false`
  - **Disparo tarde (13h Brasília / 16h UTC)**: busca serviços de HOJE com `periodo = 'tarde'` e `confirmacao_whatsapp IS NULL` e `permite_encaixe = false`
- Excluir encaixes do disparo (já receberam na criação)
- Manter template e lógica de registro em `confirmacoes_agendamento`

**3. Ajustar cron schedule (via SQL)**
- Atual: 2 disparos (18h e 8h UTC)
- Novo: 2 disparos (10h UTC = 7h BRT e 16h UTC = 13h BRT)

**4. `supabase/functions/cron-atribuir-tarefas/index.ts`** (sem mudança funcional)
- A lógica já trata encaixes com `confirmacao_whatsapp IS NULL` corretamente
- Apenas adicionar log para rastreabilidade quando encaixe é atribuído imediatamente

### Fluxo Encaixe
```text
Serviço criado (permite_encaixe=true)
  → WhatsApp confirmação enviado ao CLIENTE imediatamente
  → cron-atribuir-tarefas disparado
  → Técnico mais próximo recebe a tarefa
  → Template servico_atribuido_v1 enviado ao TÉCNICO
```

### Fluxo Normal
```text
Serviço criado (permite_encaixe=false, periodo=manha)
  → 7h: WhatsApp confirmação enviado ao CLIENTE
  → Cliente responde SIM → confirmacao_whatsapp = 'confirmada'
  → cron-atribuir-tarefas atribui ao técnico mais próximo
  → Template servico_atribuido_v1 enviado ao TÉCNICO
```

### Arquivos
- **Editar**: `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- **Editar**: `supabase/functions/confirmar-vistorias-manha-cron/index.ts`
- **SQL**: Atualizar cron schedule
- **Deploy**: ambas as Edge Functions

