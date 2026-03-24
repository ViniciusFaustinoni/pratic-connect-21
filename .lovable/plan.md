

# Encaixe com confirmação via WhatsApp antes da atribuição

## Problema atual

Serviços com `permite_encaixe = true` **ignoram** o fluxo de confirmação WhatsApp — são atribuídos automaticamente sem consultar o associado. Isso acontece porque os filtros nas funções de atribuição incluem `permite_encaixe.eq.true` como exceção ao requisito de confirmação.

## Solução

Criar um fluxo de confirmação específico para encaixes: quando o sistema detectar um encaixe elegível para atribuição, primeiro envia uma mensagem de confirmação ao associado e só atribui após resposta positiva.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/cron-atribuir-tarefas/index.ts` | **Editar** — remover bypass de encaixe no filtro de confirmação; adicionar lógica para enviar confirmação a encaixes pendentes |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | **Editar** — remover bypass de encaixe no filtro de confirmação; adicionar lógica para enviar confirmação |
| `supabase/functions/whatsapp-webhook/index.ts` | **Verificar** — já trata resposta "SIM" e marca `confirmacao_whatsapp = 'confirmada'` (sem mudança necessária) |

## Detalhes

### 1. Remover bypass de encaixe nos filtros de atribuição

Nas 3 queries de busca de serviços (BUSCA 1, BUSCA 2, BUSCA 3) em ambas as funções, alterar o filtro:

**Antes:**
```
.or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada,permite_encaixe.eq.true')
```

**Depois:**
```
.or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada')
```

Porém, serviços com `confirmacao_whatsapp IS NULL` ainda passam. Para encaixes, precisamos interceptá-los antes da atribuição.

### 2. Lógica de confirmação pré-atribuição para encaixes

Em ambas as funções (`cron-atribuir-tarefas` e `atribuir-proxima-tarefa`), **antes de atribuir** um serviço com `permite_encaixe = true` e `confirmacao_whatsapp IS NULL`:

1. **Não atribuir** — em vez disso, enviar confirmação via WhatsApp ao associado
2. Marcar `confirmacao_whatsapp = 'aguardando_confirmacao_encaixe'` no serviço
3. Pular para o próximo serviço na fila

O fluxo fica:

```text
Encaixe detectado (permite_encaixe=true, confirmacao_whatsapp=null)
  ├── Enviar WhatsApp: "Temos um profissional disponível próximo a você. Confirma encaixe HOJE?"
  ├── Marcar confirmacao_whatsapp = 'aguardando_confirmacao_encaixe'
  └── NÃO atribuir ainda

Associado responde "SIM" (webhook já existente)
  └── confirmacao_whatsapp = 'confirmada'
      └── Próxima execução do cron → serviço é atribuído normalmente
```

### 3. Implementação na lógica de atribuição

Após selecionar o melhor serviço para um profissional, adicionar verificação:

```typescript
// Antes de atribuir, verificar se encaixe precisa de confirmação
if (servico.permite_encaixe && !servico.confirmacao_whatsapp) {
  // Buscar dados do associado para envio
  // Enviar template de confirmação via whatsapp-send-text
  // Marcar como 'aguardando_confirmacao_encaixe'
  // Continuar para próximo serviço (não atribuir)
  continue;
}
```

A mensagem de confirmação usará o template `confirmacao_agendamento_v1` (já existente) com parâmetros adaptados para encaixe, informando que há um profissional disponível na região.

### 4. Webhook — sem mudança

O `whatsapp-webhook` já trata respostas de confirmação e marca `confirmacao_whatsapp = 'confirmada'`. Encaixes confirmados serão atribuídos na próxima execução do cron normalmente.

### Fluxo resultante

```text
Serviço com encaixe criado
  │
  ├── Cron detecta profissional próximo disponível
  │   ├── Se confirmacao_whatsapp IS NULL → envia confirmação, marca 'aguardando_confirmacao_encaixe'
  │   ├── Se 'aguardando_confirmacao_encaixe' → pula (aguardando resposta)
  │   └── Se 'confirmada' → atribui normalmente
  │
  └── Associado responde SIM → confirmada → próximo cron atribui
```

