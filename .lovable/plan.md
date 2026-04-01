

# Remover envio duplicado do template "técnico a caminho"

## Problema
O template WhatsApp `tecnico_a_caminho_1` está sendo enviado **duas vezes** ao associado:
1. No `cron-atribuir-tarefas` — quando o instalador/vistoriador é atribuído automaticamente
2. No `notificar-inicio-rota` — quando o instalador clica "Iniciar Rota"

O correto é enviar **apenas uma vez**, no momento em que o técnico efetivamente inicia o deslocamento (Iniciar Rota). A function `atribuir-proxima-tarefa` já teve essa correção aplicada anteriormente (comentário na linha 1001), mas o `cron-atribuir-tarefas` ainda dispara.

## Correção

### Arquivo: `supabase/functions/cron-atribuir-tarefas/index.ts`

**Bloco 1 — Instalações (linhas 773-790)**: Remover ou comentar o bloco que envia `tecnico_em_rota` ao associado na atribuição de instalações.

**Bloco 2 — Vistorias (linhas 941-963)**: Remover ou comentar o bloco que envia `tecnico_em_rota` ao associado na atribuição de vistorias.

Ambos os blocos serão comentados com a mesma nota já presente em `atribuir-proxima-tarefa`:
```
// Notificação "técnico a caminho" removida daqui — agora é enviada apenas
// quando o instalador clica "Iniciar Rota" (via notificar-inicio-rota)
```

## Impacto
- 1 edge function alterada, 2 blocos removidos
- O associado recebe a notificação somente quando o técnico realmente inicia o deslocamento
- Precisa de deploy da edge function

