

## Plano: Corrigir erro "Assignment to constant variable" no agente-consultor-ia

### Problema
O log mostra: `TypeError: Assignment to constant variable` no handler de `salvar_dados_cliente`. A variavel `dadosCotacao` e declarada como `const` na linha 255, mas e reatribuida nas linhas 746 e 772 apos tool calls.

### Correção

**Arquivo: `supabase/functions/agente-consultor-ia/index.ts`**

Linha 255: trocar `const` por `let`:
```typescript
// De:
const dadosCotacao = contato?.dados_cotacao || null;
// Para:
let dadosCotacao = contato?.dados_cotacao || null;
```

Apenas 1 caractere muda. Deploy da edge function em seguida.

