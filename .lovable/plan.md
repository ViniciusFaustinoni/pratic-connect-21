

## Plano: Corrigir etapa "Assinando Contrato" no painel de cotações

### Problema
Duas questões distintas:

1. **Etapa nunca aparece**: Existe a config `assinando_contrato` (linha 125) mas `getEtapaVenda` nunca retorna esse valor. Quando o contrato é gerado e pendente de assinatura (`status_contratacao = 'contrato_gerado'` com contrato `pendente_assinatura`), a função pula direto para `realizando_pagamento` ou `vistoria_agendada`.

2. **Badge "Associado Ativo" indevida**: Se o associado já está ativo (de plano anterior), a condição na linha 194 pode retornar `associado_ativo` antes de checar se o contrato **desta cotação** está pendente de assinatura.

### Solução

**Arquivo: `src/components/cotacoes/CotacoesTable.tsx`** e **`CotacaoCard.tsx`**

Adicionar verificação de contrato pendente de assinatura **antes** da verificação de associado ativo:

```typescript
// ADICIONAR antes da linha 194 (prioridade sobre associado_ativo):
// Se contrato existe mas está pendente de assinatura, mostrar "Assinando Contrato"
if (contratoStatus === 'pendente_assinatura') return 'assinando_contrato';

// Também ajustar o bloco de status_contratacao (linha 242):
// ANTES:
if (statusContratacao === 'contrato_assinado' || statusContratacao === 'contrato_gerado') {
  if (adesaoPaga === false) return 'realizando_pagamento';
  return 'vistoria_agendada';
}

// DEPOIS:
if (statusContratacao === 'contrato_gerado') {
  // Se contrato ainda não foi assinado, mostrar etapa de assinatura
  if (!contratoStatus || contratoStatus === 'pendente_assinatura') return 'assinando_contrato';
  if (adesaoPaga === false) return 'realizando_pagamento';
  return 'vistoria_agendada';
}
if (statusContratacao === 'contrato_assinado') {
  if (adesaoPaga === false) return 'realizando_pagamento';
  return 'vistoria_agendada';
}
```

Isso garante que a badge "Assinando Contrato" (laranja) aparece quando o contrato foi gerado e está aguardando assinatura, em vez de mostrar "Associado Ativo" ou pular para pagamento.

### Arquivos alterados
- `src/components/cotacoes/CotacoesTable.tsx`
- `src/components/cotacoes/CotacaoCard.tsx`

