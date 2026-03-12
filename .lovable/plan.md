

# Fix: WhatsApp "técnico a caminho" enviado no momento errado

## Problema

A mensagem "técnico a caminho" está sendo enviada **na atribuição** (quando o cron/sistema atribui a tarefa ao instalador), em vez de quando o **instalador clica "Iniciar Rota"**.

```text
Fluxo ATUAL (errado):
  Cron atribui tarefa → envia "tecnico_em_rota" ao cliente ❌ (prematuro)
  Instalador clica "Iniciar Rota" → envia "tecnico_em_rota" novamente ✓ (duplicado)

Fluxo CORRETO:
  Cron atribui tarefa → NÃO envia WhatsApp ao cliente (apenas push ao instalador)
  Instalador clica "Iniciar Rota" → envia "tecnico_em_rota" ao cliente ✓ (único disparo)
```

A notificação está sendo disparada em **3 lugares**:
1. `atribuir-proxima-tarefa/index.ts` (linha ~854) — na atribuição ❌
2. `cron-atribuir-tarefas/index.ts` (linha ~466) — na atribuição ❌
3. `notificar-inicio-rota/index.ts` — quando instalador clica "Iniciar Rota" ✓

## Correção

Remover o envio de `tecnico_em_rota` dos pontos 1 e 2, mantendo apenas no ponto 3 (`notificar-inicio-rota`), que já é chamado corretamente pelo hook `useTarefaAtual.ts` quando o instalador clica "Iniciar Rota".

### Arquivo 1: `supabase/functions/atribuir-proxima-tarefa/index.ts`
- Remover o bloco que invoca `notificar-cliente` com tipo `tecnico_em_rota` (~linhas 830-874)

### Arquivo 2: `supabase/functions/cron-atribuir-tarefas/index.ts`
- Remover o bloco que invoca `notificar-cliente` com tipo `tecnico_em_rota` (~linhas 464-481)

### Nenhuma outra alteração necessária
O `notificar-inicio-rota` já funciona corretamente e é acionado pelo botão "Iniciar Rota" no app do instalador.

