

# Diagnóstico e Plano de Correção: Templates Errados e Mensagens Duplicadas

## Problema 1: Template errado sendo enviado

### Causa raiz
O template `confirmacao_agendamento_v1` tem status **PENDING** (não aprovado pela Meta). Quando `whatsapp-send-text` tenta enviá-lo, o fallback automático (linhas 134-168) busca templates aprovados na ordem: `notificacao_geral_v1` → `sinistro_atualizado`.

Como `notificacao_geral_v1` também não está aprovado, o sistema cai no **`sinistro_atualizado`** (que está APPROVED), cujo corpo é:

```
"Olá {{1}}, há uma atualização no seu sinistro {{2}}: {{3}}. Acompanhe pelo app."
```

Os params enviados (`nome`, `instalação do rastreador`, `Encaixe HOJE - profissional disponível na região`) são injetados nesse template de **sinistro**, gerando a mensagem absurda que o MARCUS recebeu.

### Correção
1. **Aprovar o template `confirmacao_agendamento_v1` na Meta** ou criar um template específico para encaixe
2. **Corrigir a cadeia de fallback** em `whatsapp-send-text`: quando o template original é de confirmação de encaixe, o fallback não pode ser `sinistro_atualizado` — é melhor **bloquear o envio** do que enviar um template com contexto completamente errado

---

## Problema 2: Mensagens enviadas dezenas de vezes (10x em 48 segundos)

### Causa raiz
A função `atribuir-proxima-tarefa` (chamada pelo frontend a cada 30 segundos por cada profissional ativo) **NÃO tem lock atômico** para encaixes. O fluxo atual é:

```text
1. Lê servico.confirmacao_whatsapp → null ✓
2. Envia WhatsApp (leva ~1-3s)
3. Atualiza confirmacao_whatsapp = 'aguardando_confirmacao_encaixe'
```

Entre os passos 1 e 3, outras chamadas (do mesmo profissional via polling ou do cron) leem `confirmacao_whatsapp = null` e enviam novamente. Resultado: 10 mensagens idênticas.

Em contraste, o `cron-atribuir-tarefas` **já tem** o lock atômico correto (linhas 566-577): faz o UPDATE antes do envio, com `WHERE confirmacao_whatsapp IS NULL`.

### Correção
Replicar o padrão de lock atômico do `cron-atribuir-tarefas` no `atribuir-proxima-tarefa`:

```typescript
// ANTES de enviar WhatsApp:
const { data: lockResult } = await supabase
  .from('servicos')
  .update({ confirmacao_whatsapp: 'aguardando_confirmacao_encaixe' })
  .eq('id', servico.id)
  .is('confirmacao_whatsapp', null)
  .select('id');

if (!lockResult || lockResult.length === 0) {
  console.log('Já processado por outra execução - pulando');
  continue;
}

// SÓ ENTÃO enviar WhatsApp
```

Adicionar também constraint UNIQUE na tabela `confirmacoes_agendamento` para `(servico_id, status)` ativo, como proteção extra.

---

## Resumo das correções

| Arquivo | Acao |
|---|---|
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Adicionar lock atômico (UPDATE antes do envio) no fluxo de encaixe, igual ao `cron-atribuir-tarefas` |
| `supabase/functions/whatsapp-send-text/index.ts` | Corrigir cadeia de fallback: não usar `sinistro_atualizado` como fallback para templates de confirmação/agendamento — bloquear envio com erro claro |
| Migration SQL | Adicionar constraint UNIQUE em `confirmacoes_agendamento(servico_id)` com filtro de status ativo, para impedir duplicatas no banco |
| Limpeza de dados | Remover as 9 confirmações duplicadas do servico `882ad539...` |

### Impacto esperado
- Zero mensagens duplicadas: lock atômico garante que apenas uma execução processa cada encaixe
- Zero mensagens com template errado: fallback não usará mais templates de contexto diferente
- Se o template correto não estiver aprovado, o sistema loga erro em vez de enviar mensagem confusa ao associado

