

# Adicional Mensal: Premium (+R$30) e Exclusive (+R$60) sobre o Basic

## Situação Atual
- A coluna `adicional_mensal` já existe na tabela `planos` mas está zerada para todos os planos (exceto os de APLICATIVO que já têm R$60).
- **O campo nunca é aplicado nos cálculos de preço** — os hooks `useCotacao.ts`, `useCalcularCotacao.ts` e `CalculadoraPreco.tsx` ignoram completamente o `adicional_mensal`.

## O que será feito

### 1. Atualizar dados no banco (migration SQL)
| Plano | adicional_mensal |
|-------|-----------------|
| SELECT BASIC | 0 (já está) |
| SELECT PREMIUM | **30** |
| SELECT EXCLUSIVE | **60** |
| LANÇAMENTO BASIC | 0 (já está) |
| LANÇAMENTO PREMIUM | **30** |
| LANÇAMENTO EXCLUSIVE | **60** |

### 2. Aplicar `adicional_mensal` nos cálculos de preço

**3 pontos de cálculo precisam ser corrigidos:**

**A. `src/hooks/useCotacao.ts`** — Cotação interna (vendedores)
- Na função `encontrarFaixaMensalidade`: após encontrar o valor base da faixa, somar o `adicional_mensal` do plano.
- Precisa receber o `adicional_mensal` do plano como parâmetro.
- Na função `useCalcularCotacao.calcular`: passar o adicional ao chamar `encontrarFaixaMensalidade`.

**B. `src/hooks/useCalcularCotacao.ts`** — Cotação pública (cotador externo)
- Após encontrar a faixa de preço (linha 131), somar `plano.adicional_mensal` ao `valorMensal`.
- O plano já é buscado com `select('*')`, então o campo já vem do banco.

**C. `src/components/planos/CalculadoraPreco.tsx`** — Calculadora de preços
- A calculadora mostra preços por **linha** (não por plano), então não aplica adicional por plano individual. Sem alteração necessária aqui — o adicional só aparece na cotação onde o plano específico é selecionado.

### 3. Incluir `adicional_mensal` no tipo e mapeamento

**`src/types/cotacao.ts`** — Adicionar `adicional_mensal` ao `PlanoParaCotacao`:
```typescript
adicional_mensal: number;
```

**`src/hooks/useCotacao.ts`** — No `mapPlanoToInterface`:
```typescript
adicional_mensal: Number(data.adicional_mensal || 0),
```

### 4. CRUD já existente
O campo `adicional_mensal` já é editável via o formulário de planos (`PlanFormModal.tsx` → `usePlansAdmin.ts`), então a diretoria pode alterar os valores a qualquer momento sem precisar de código ou SQL.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | UPDATE 4 planos com adicional_mensal |
| `src/types/cotacao.ts` | Adicionar campo `adicional_mensal` |
| `src/hooks/useCotacao.ts` | Mapear e aplicar adicional no cálculo |
| `src/hooks/useCalcularCotacao.ts` | Aplicar adicional no cálculo público |

