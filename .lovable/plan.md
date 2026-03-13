

## Problema

Quando o pagamento da adesão é confirmado no `asaas-webhook`, **dois fluxos disparam simultaneamente**:

1. **`disparar-notificacao`** com `tipo: 'boleto', subtipo: 'pago'` → envia WhatsApp com template `sinistro_atualizado` ("Pagamento confirmado com sucesso!")
2. **Fluxo de aprovação** (manual pelo analista) → `ativar-associado` → envia WhatsApp com template `cadastro_aprovado_botao` (boas-vindas)

Como a aprovação costuma ocorrer logo após o pagamento ser confirmado, o associado recebe as duas mensagens quase juntas: a de boas-vindas E uma "atualização de sinistro" que na verdade é confirmação de pagamento.

Além disso, o template `sinistro_atualizado` é completamente inadequado para confirmação de pagamento de adesão — confunde o novo associado.

```text
Pagamento adesão confirmado (asaas-webhook)
    ├─ disparar-notificacao (boleto/pago) → sinistro_atualizado ← PROBLEMA
    └─ ... fluxo de instalação + aprovação
            └─ ativar-associado → cadastro_aprovado_botao ← boas-vindas
```

## Solução

No `asaas-webhook`, **não disparar `disparar-notificacao`** quando a cobrança for do tipo `adesao`. O pagamento de adesão já é tratado pelo fluxo específico (Autentique, instalação, boas-vindas). O `disparar-notificacao` com `boleto/pago` deve continuar funcionando para **mensalidades** (cobranças normais).

### Alteração

**Arquivo**: `supabase/functions/asaas-webhook/index.ts` (linhas 355-371)

Adicionar condição para pular o `disparar-notificacao` quando `cobranca.tipo === 'adesao'`:

```typescript
// Disparar notificação centralizada (apenas para mensalidades, não adesão)
if (associadoUser?.user_id && cobranca?.tipo !== 'adesao') {
  await supabase.functions.invoke('disparar-notificacao', {
    body: {
      user_id: associadoUser.user_id,
      associado_id: cobranca.associado_id,
      tipo: 'boleto',
      subtipo: 'pago',
      dados: { 
        valor: payment.value.toFixed(2),
        mes: cobranca.competencia || 'Mensalidade'
      },
      referencia_tipo: 'cobranca',
      referencia_id: cobranca.id
    }
  });
}
```

### Deploy
Redeployar `asaas-webhook` após a alteração.

### Resultado
- Pagamento de **adesão**: apenas o fluxo de boas-vindas (`cadastro_aprovado_botao`) será enviado
- Pagamento de **mensalidade**: continua enviando confirmação via `disparar-notificacao` normalmente

