

# Motos e Elétricos — Diagnóstico e Plano de Correção

## Problemas Encontrados

### 1. Motos não funcionam em nenhum lugar (Calculadora, Cotações, Cotador)

**Causa raiz**: A tabela `tabelas_preco_mensalidade` usa `tipo_uso = 'advanced'` e `'advanced-plus'` para motos. Porém, `resolverTipoUsoQuery()` sempre retorna `'particular'` como default — nunca retorna `'advanced'`. Resultado: busca por `tipo_uso='particular'` numa tabela que só tem `'advanced'` → zero matches → fallback ou "Consulte um consultor".

```text
Fluxo atual (QUEBRADO):
  plano_preco_map.tipo_uso = 'advanced'
  → resolverTipoUsoQuery('advanced', 'rj', 'advanced')
  → retorna 'particular' (default)
  → busca tipo_uso='particular' na tabela
  → TABELA TEM tipo_uso='advanced' → SEM MATCH
```

Afeta: `CalculadoraPreco.tsx`, `usePlanosCotacao.ts`, `useCalcularCotacao.ts`

### 2. Elétricos aparecem misturados com carros nas cotações

A `product_lines` tem `vehicle_type = 'car'` para a linha Elétrico. O filtro `if (tipoVeiculo === 'carro' && vehicleType === 'motorcycle') continue` não exclui elétricos. Resultado: plano ELÉTRICOS aparece quando o vendedor cota um carro normal.

### 3. Calculadora não mostra Advanced e Advanced+ separados

A calculadora itera por `linha_slug` (ambos compartilham `'advanced'`), pegando apenas um `tipo_uso`. Precisa iterar por `linha_slug + tipo_uso` para mostrar as duas variantes.

## Plano de Correção

### A. Corrigir `resolverTipoUsoQuery` — passar valores de moto direto

Se `tipoUso` já é um valor específico de linha (como `'advanced'`, `'advanced-plus'`), retorná-lo diretamente em vez de forçar `'particular'`.

### B. Corrigir `CalculadoraPreco.tsx` — iterar por `linha_slug + tipo_uso`

Para motos, iterar sobre os pares únicos (`advanced/advanced`, `advanced/advanced-plus`) para exibir ambas as linhas. Adicionar labels para `'advanced-plus'`.

### C. Corrigir `usePlanosCotacao.ts` — excluir elétricos de carros

Adicionar filtro: quando `tipoVeiculo === 'carro'`, excluir planos cuja `linha_slug === 'eletrico'`. Quando `tipoVeiculo === 'moto'`, também excluir elétricos.

### D. Corrigir `useCalcularCotacao.ts` — mesma lógica de tipo_uso

Aplicar a mesma correção do `resolverTipoUsoQuery` para que planos Advanced encontrem a faixa correta.

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/utils/precoApp.ts` | Passar 'advanced'/'advanced-plus' direto |
| `src/components/planos/CalculadoraPreco.tsx` | Iterar por linha+tipo_uso para motos |
| `src/hooks/usePlanosCotacao.ts` | Excluir elétricos de carros/motos |
| `src/hooks/useCalcularCotacao.ts` | Mesma correção de tipo_uso |

