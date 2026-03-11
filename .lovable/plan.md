

# Diagnóstico: O código já está correto — possível problema de build

## Achado da auditoria

Todos os 4 hooks **já possuem** a lógica de `adicional_mensal` e `desconto_percentual` corretamente implementada:

| Hook | SELECT | Aplica adicional | Aplica desconto |
|------|--------|-----------------|-----------------|
| `usePlanosCotacao.ts` (L258-268) | `*` (inclui tudo) | ✅ L259 | ✅ L262-267 |
| `useCalcularCotacao.ts` (L135-145) | `*` (inclui tudo) | ✅ L136 | ✅ L140-145 |
| `useCotacaoAvancada.ts` (L84, L157-164) | Explícito com campos | ✅ L158 | ✅ L161-163 |
| `useCotacao.ts` (L168-176) | `*` (inclui tudo) | ✅ L169 | ✅ via função |

**O banco de dados também está correto**: SELECT PREMIUM tem `adicional_mensal = 30`, SELECT EXCLUSIVE tem `adicional_mensal = 60`, SELECT ONE 5% PROMO tem `desconto_percentual = 5`.

## Possível causa raiz

O código pode não ter sido recompilado/atualizado no preview após as edições anteriores. 

## Plano de ação

### 1. Forçar recompilação com console.log de debug
Adicionar um `console.log` temporário em `usePlanosCotacao.ts` (o hook usado pelo `CotacaoFormDialog`) para:
- Confirmar que `adicional_mensal` e `desconto_percentual` chegam do banco
- Confirmar o valor final calculado
- Forçar o Vite a recompilar o módulo

```typescript
// Após linha 259 em usePlanosCotacao.ts
console.log(`[AJUSTE] ${plano.nome}: base=${valorMensal - Number(plano.adicional_mensal || 0)} + adicional=${plano.adicional_mensal} - desconto=${descontoPerc}% = final=${valorMensal}`);
```

### 2. Se o log confirmar que os valores estão corretos
O problema era de cache/build — remover o console.log e confirmar que funciona.

### 3. Se o log mostrar que `adicional_mensal` é 0 ou null
Investigar se há algum middleware, RLS policy ou transformação de dados que está zerando esses campos.

## Arquivos a alterar
- `src/hooks/usePlanosCotacao.ts` — adicionar console.log temporário (1 linha)

