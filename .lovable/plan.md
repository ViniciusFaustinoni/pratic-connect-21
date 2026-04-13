

## Diagnóstico: "Sim" não reconhecido como confirmação no webhook Meta

### Causa raiz

A lógica de verificação de confirmação de agendamento (`confirmacoes_agendamento`) existe **apenas** na Edge Function `whatsapp-webhook` (Evolution API, linha 3290-3304). A Edge Function `whatsapp-meta-webhook` (Meta API oficial) **não possui essa verificação**. Quando o associado responde "Sim" via Meta, o fluxo vai direto para a fila da Maya IA, que gera uma saudação genérica ("Oi, Marcos! Como posso te ajudar hoje? 🚗").

### Fluxo atual (Meta webhook)

```text
Mensagem recebida → Busca associado ativo → Insere na fila IA → Maya responde genérico
                     (PULA confirmação!)
```

### Fluxo corrigido

```text
Mensagem recebida → Busca confirmação pendente → Se encontrou: processar confirmação
                                                → Se não: continuar fluxo normal (fila IA)
```

### Alterações

**1. `supabase/functions/whatsapp-meta-webhook/index.ts`**
- Na função `processarMensagemUsuario`, **antes** da busca de associado (linha 63), adicionar verificação de `confirmacoes_agendamento`:
  - Buscar registro com telefone correspondente e status `['enviada', 'reagendando', 'aguardando_confirmacao_vespera']`
  - Se encontrado e tipo da mensagem for texto, delegar para a função `processarRespostaConfirmacaoMeta` (nova)
- Criar função `processarRespostaConfirmacaoMeta` que:
  - Usa o mesmo regex fallback do webhook Evolution para inferir intenção (CONFIRMADO, REAGENDAR, CANCELAR, DUVIDA)
  - Atualiza `confirmacoes_agendamento` com resposta e novo status
  - Se CONFIRMADO: atualiza `servicos.confirmacao_whatsapp` e dispara atribuição automática
  - Se REAGENDAR: inicia fluxo de reagendamento
  - Envia resposta apropriada via `whatsapp-send-text`

**2. Deploy da Edge Function `whatsapp-meta-webhook`**

### Escopo
- 1 Edge Function editada (~80 linhas adicionadas)
- 1 deploy

