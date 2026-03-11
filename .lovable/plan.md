

# Corrigir exibição do Valor Mensal na Gestão Comercial

## Problema
Na aba "Faixas de Preço" da Gestão Comercial, o valor mensal exibido é o valor bruto da tabela `tabelas_preco_mensalidade` — sem aplicar o `adicional_mensal` nem o `desconto_percentual` do plano. Por isso BASIC, PREMIUM e EXCLUSIVE mostram o mesmo preço.

**Linha causadora**: `ProdutosPlanos.tsx`, linha 407:
```typescript
{formatCurrency(Number(f.valor_mensal))}  // ← valor bruto, sem ajuste
```

## Solução
Aplicar os ajustes do plano selecionado (`selectedPlan.adicional_mensal` e `selectedPlan.desconto_percentual`) ao `valor_mensal` de cada faixa antes de exibir.

### Alteração em `src/components/gestao-comercial/ProdutosPlanos.tsx`

1. **Criar função local** que calcula o valor ajustado:
```typescript
function calcularValorAjustado(valorBase: number, adicional: number, desconto: number): number {
  let valor = valorBase + adicional;
  if (desconto > 0) valor *= (1 - desconto / 100);
  return Math.round(valor * 100) / 100;
}
```

2. **Na célula de Valor Mensal** (linha 406-408), substituir o valor bruto pelo valor ajustado usando `selectedPlan.adicional_mensal` e `selectedPlan.desconto_percentual`.

3. **Mostrar indicador visual** quando houver ajuste (ex: tooltip ou texto pequeno mostrando "base + adicional").

### Arquivo alterado
- `src/components/gestao-comercial/ProdutosPlanos.tsx` — aplicar ajuste na renderização da tabela de preços

