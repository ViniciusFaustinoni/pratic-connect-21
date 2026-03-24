

# Plano: Encaixe com confirmação obrigatória do associado

## Problema
Quando um profissional clica "Assumir" em um encaixe (ou um coordenador atribui manualmente), o sistema atribui diretamente sem confirmar com o associado. A confirmação via WhatsApp já existe no fluxo automático do cron, mas os fluxos manuais (client-side) a contornam completamente.

## O que já funciona
Os cron jobs (`cron-atribuir-tarefas` e `atribuir-proxima-tarefa`) já:
- Enviam WhatsApp de confirmação antes de atribuir encaixe
- Marcam `confirmacao_whatsapp: 'aguardando_confirmacao_encaixe'`
- Criam registro em `confirmacoes_agendamento`
- Só atribuem após resposta "SIM" (processada pela IA no webhook)

## O que NÃO funciona
Os hooks client-side contornam tudo:
- `usePuxarEncaixe` — profissional clica "Assumir" → atribui direto
- `useAtribuirEncaixe` — coordenador atribui → atribui direto

## Solução

Criar uma **edge function `solicitar-encaixe`** que centraliza a lógica de confirmação. Os hooks client-side passam a chamar essa função em vez de fazer update direto.

### Fluxo novo

```text
Profissional clica "Assumir"
  → Chama edge function solicitar-encaixe
    → Envia WhatsApp de confirmação ao associado
    → Marca confirmacao_whatsapp = 'aguardando_confirmacao_encaixe'
    → Cria registro em confirmacoes_agendamento (com profissional_id)
    → Retorna { status: 'aguardando_confirmacao' }
  → UI mostra feedback "Confirmação enviada ao cliente"

Associado responde SIM (webhook já trata isso)
  → confirmacao_whatsapp = 'confirmada'
  → Próxima execução do cron atribui o serviço ao profissional salvo no contexto
```

### Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/functions/solicitar-encaixe/index.ts` | **Criar** — Edge function que envia confirmação WhatsApp e marca serviço como aguardando |
| `src/hooks/useEncaixesDisponiveis.ts` | **Alterar** `usePuxarEncaixe` — chamar `solicitar-encaixe` em vez de update direto. Ajustar feedback para "Confirmação enviada" |
| `src/components/vistoriador/EncaixeCard.tsx` | **Alterar** — Atualizar labels dos botões e feedback (de "Assumindo..." para "Solicitando...") |

### Edge function `solicitar-encaixe`

Recebe: `{ servico_id, tipo, profissional_id, isAdiantamento }`

Lógica:
1. Buscar dados do serviço e associado (telefone, nome)
2. Enviar WhatsApp via `whatsapp-send-text` com template `confirmacao_agendamento_v1`
3. Atualizar `servicos.confirmacao_whatsapp = 'aguardando_confirmacao_encaixe'`
4. Inserir em `confirmacoes_agendamento` com `contexto_ia` incluindo `profissional_id`
5. Retornar sucesso

### O que NÃO muda
- Webhook de resposta (já funciona)
- Cron de atribuição (já respeita confirmação)
- Cron de expiração (já expira confirmações não respondidas)
- Fluxo do coordenador (`useAtribuirEncaixe`) — mantém atribuição direta, pois é decisão manual da diretoria

