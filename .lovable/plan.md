

# Fix: Aplicar desconto percentual no `useCotacaoAvancada.ts`

## Problema

Existe um **terceiro ponto de cálculo** que foi ignorado nas alterações anteriores: `src/hooks/useCotacaoAvancada.ts`. Este hook é usado pelo `QuoteCalculatorModal` (cotação do vendedor) e:

1. **Não busca** `adicional_mensal` nem `desconto_percentual` do banco (linha 84 — select limitado)
2. **Não aplica** nenhum dos dois ao calcular `valorMensal` (linha 155)

Por isso SELECT ONE e SELECT ONE 5% PROMO mostram valores idênticos.

## Correção

**Arquivo**: `src/hooks/useCotacaoAvancada.ts`

1. **Linha 84** — Adicionar campos ao select:
```
.select('id, codigo, nome, categoria, valor_adesao, descricao, adicional_mensal, desconto_percentual')
```

2. **Linhas 155-156** — Após buscar o valor base da faixa, aplicar adicional e desconto:
```typescript
let valorMensal = resolverPrecoApp(...);

// Aplicar adicional_mensal do plano (Premium +30, Exclusive +60)
valorMensal += Number(plano.adicional_mensal || 0);

// Aplicar desconto percentual dinâmico (5% OFF)
const descontoPerc = Number(plano.desconto_percentual || 0);
if (descontoPerc > 0) {
  valorMensal *= (1 - descontoPerc / 100);
}
```

3. Aplicar o mesmo desconto ao `valorDesagio` se existir.

**1 arquivo, ~10 linhas alteradas.**

