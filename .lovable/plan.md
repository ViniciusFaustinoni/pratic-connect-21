

# Diagnostico: Disparo Duplicado de WhatsApp para Encaixe

## Causa Raiz

O cron `cron-atribuir-tarefas` roda a cada 5 minutos. Quando encontra um servico com `permite_encaixe=true`, ele itera sobre **cada profissional online** separadamente. Para CADA profissional, faz uma nova query de servicos e encontra o mesmo servico de encaixe.

O problema esta na **ordem das operacoes** (linhas 555-632):

```text
1. Query servicos (encontra encaixe com confirmacao_whatsapp = NULL)
2. Envia WhatsApp  ← mensagem duplicada
3. Atualiza confirmacao_whatsapp = 'aguardando_confirmacao_encaixe'
4. continue
```

Se 5 profissionais estao online, cada um executa sua propria query. Mesmo com `await`, ha uma **race condition real**: entre a query do profissional 1 retornar e o update ser commitado, o profissional 2 ja pode ter iniciado sua query. Alem disso, se 2 execucoes do cron se sobrepuserem (timeout > 5min), o problema dobra.

**Resultado**: 10+ mensagens identicas em 1 minuto, como visto no screenshot.

## Plano de Correcao

### 1. Dedup em memoria (dentro da mesma execucao)
Criar um `Set<string>` antes do loop de profissionais para rastrear servicos que ja tiveram confirmacao de encaixe enviada. Se o servico ja esta no Set, pular.

### 2. Update atomico ANTES do envio (prevenir corrida entre execucoes)
Inverter a ordem: primeiro fazer `UPDATE servicos SET confirmacao_whatsapp = 'aguardando_confirmacao_encaixe' WHERE id = X AND confirmacao_whatsapp IS NULL` com `.select()`. Se o update nao retornar nenhuma linha (outro processo ja atualizou), pular o envio.

### 3. Mover query de encaixe para FORA do loop de profissionais
A busca de servicos de encaixe e identica para todos os profissionais. Buscar uma unica vez e distribuir, em vez de repetir a query N vezes.

### Alteracoes

**Arquivo**: `supabase/functions/cron-atribuir-tarefas/index.ts`

| Local | Mudanca |
|-------|---------|
| Antes do loop de profissionais (~linha 150) | Adicionar `const encaixesJaEnviados = new Set<string>()` |
| Linha 555 (condicao de encaixe) | Adicionar check: `if (encaixesJaEnviados.has(servico.id)) continue` |
| Linhas 604-607 (update confirmacao) | Mover para ANTES do envio WhatsApp, usando update condicional com `.is('confirmacao_whatsapp', null).select()` e verificar se retornou row |
| Apos envio bem-sucedido | Adicionar `encaixesJaEnviados.add(servico.id)` |

**Redeploy** da edge function apos a correcao.

