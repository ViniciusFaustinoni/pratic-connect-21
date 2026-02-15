
# Notificações Push Automáticas para Regulador em Novas Vistorias

## Contexto Atual

- O sistema ja tem a edge function `send-push-profissional` que envia push notifications para profissionais usando Web Push (VAPID).
- A tabela `push_subscriptions_profissionais` armazena as subscriptions dos reguladores.
- A vistoria e criada pelo associado em `useCriarVistoriaAgendada` sem um `vistoriador_id` (atribuicao ocorre depois via cron ou manualmente).
- O cron `cron-atribuir-tarefas` atribui o `vistoriador_id` na vistoria e ja notifica via WhatsApp, mas nao via push.

## Solucao em 2 Pontos

### Ponto 1 -- Notificar reguladores quando nova vistoria e agendada

Quando o associado agenda uma vistoria, disparar uma notificacao push para todos os reguladores ativos (ainda nao ha um regulador especifico atribuido nesse momento).

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useContratoLink.ts` | Apos criar a vistoria com sucesso, chamar `send-push-profissional` com `action: 'broadcast'` OU chamar `disparar-notificacao` para notificar os coordenadores/reguladores via notificacao interna |

Como ainda nao ha regulador atribuido, a abordagem mais pratica e inserir uma notificacao interna (tabela `notificacoes`) para todos os usuarios com role `regulador` ou `coordenador_monitoramento`, informando que uma nova vistoria foi agendada. Isso usa o sistema ja existente de notificacoes internas.

### Ponto 2 -- Push notification quando vistoria e atribuida ao regulador

Quando o `cron-atribuir-tarefas` ou a atribuicao manual define o `vistoriador_id`, enviar push notification direta para aquele regulador especifico.

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Apos atribuir uma vistoria (bloco `servico.vistoria_origem_id`), chamar `send-push-profissional` com titulo "Nova vistoria atribuida" |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Mesma logica: apos atribuir vistoria ao profissional, chamar `send-push-profissional` |

## Detalhes Tecnicos

### Notificacao interna na criacao (Ponto 1)

No `useCriarVistoriaAgendada`, apos criar a vistoria:

```typescript
// Notificar coordenadores/reguladores sobre nova vistoria
try {
  const { data: coordenadores } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['coordenador_monitoramento', 'regulador']);

  if (coordenadores?.length) {
    for (const c of coordenadores) {
      await supabase.from('notificacoes').insert({
        user_id: c.user_id,
        titulo: 'Nova Vistoria Agendada',
        mensagem: `Vistoria agendada para ${dataAgendada} as ${horarioAgendado}`,
        tipo: 'sistema',
        subtipo: 'vistoria_agendada',
        link: '/monitoramento/vistorias',
        prioridade: 'normal',
        lida: false,
        canal_sistema: true,
      });
    }
  }
} catch (err) {
  console.error('Erro ao notificar coordenadores:', err);
}
```

### Push notification na atribuicao (Ponto 2)

No `cron-atribuir-tarefas`, apos o bloco que sincroniza com a tabela `vistorias`:

```typescript
// Enviar push notification para o regulador
try {
  await supabase.functions.invoke('send-push-profissional', {
    body: {
      profissional_id: prof.vistoriador_id,
      notification: {
        title: 'Nova Vistoria Atribuída',
        body: `Vistoria ${servico.is_encaixe ? '(encaixe)' : ''} atribuída para hoje`,
        tag: `vistoria-${servico.vistoria_origem_id}`,
        data: { url: '/instalador' },
      }
    }
  });
} catch (pushErr) {
  console.error('Erro ao enviar push:', pushErr);
}
```

Mesma logica sera adicionada em `atribuir-proxima-tarefa` no bloco equivalente.

## Arquivos a Modificar

| Arquivo | Descricao |
|---------|---------|
| `src/hooks/useContratoLink.ts` | Adicionar notificacao interna para coordenadores/reguladores apos criar vistoria |
| `supabase/functions/cron-atribuir-tarefas/index.ts` | Adicionar chamada a `send-push-profissional` apos atribuir vistoria a regulador |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Adicionar chamada a `send-push-profissional` apos atribuir vistoria a regulador |

## Sem novos arquivos ou migrações

Toda a infraestrutura necessaria (tabela `push_subscriptions_profissionais`, edge function `send-push-profissional`, tabela `notificacoes`) ja existe.
