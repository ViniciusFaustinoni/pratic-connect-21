

## Plano: Remover bloco "Serviços: {{plano.descricao}}" do contrato Autentique

### Problema
O contrato gerado no Autentique mostra literalmente `Serviços: {{plano.descricao}}` — a variável não foi substituída nem removida. O regex de limpeza na linha 153 do `template-utils.ts` é muito restritivo (espera `<strong>` em `<p>` separado) e não captura o HTML real do template.

### Solução
Atualizar o regex de remoção em `supabase/functions/_shared/template-utils.ts` (linhas 153-157) para cobrir todas as variações possíveis do bloco "Serviços":

```typescript
// Remover qualquer bloco/parágrafo que contenha "Serviços:" seguido de variável ou traço
resultado = resultado.replace(
  /<p[^>]*>\s*(<strong>)?\s*Serviços\s*:?\s*(<\/strong>)?\s*({{[^}]*}}|—|)\s*<\/p>/gi,
  ''
);
// Também remover se estiver em formato inline (sem tags de parágrafo)
resultado = resultado.replace(
  /Serviços\s*:\s*({{plano\.descricao}}|—)/gi,
  ''
);
```

Mover esta limpeza para **antes** da substituição de variáveis para garantir que o bloco inteiro seja removido antes de qualquer processamento.

### Arquivo alterado
- `supabase/functions/_shared/template-utils.ts` — linhas 153-157: ampliar regex de remoção do bloco "Serviços"

### Necessidade de deploy
Sim — a edge function `_shared` é usada por `autentique-create` e `autentique-create-by-token`, que precisarão ser re-deployed.

