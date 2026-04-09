

## Plano: Corrigir truncamento de regras de elegibilidade (limite de 1000 linhas do Supabase)

### Causa raiz

O banco possui **2.291 regras ativas** na tabela `entity_eligibility_rules`. A query em `useAllEligibilityRules()` usa `supabase.from(...).select('*').eq('is_active', true)` sem paginacao. O Supabase retorna no maximo **1.000 linhas por default**. Resultado: ~1.291 regras sao silenciosamente ignoradas. Coberturas cujas regras ficam fora dos 1.000 primeiros registros passam como se nao tivessem restricao, permitindo que planos Diesel e Desagio aparecam para veiculos que nao deveriam ve-los.

### Solucao

Modificar `useAllEligibilityRules()` em `src/hooks/useEntityEligibilityRules.ts` para buscar TODAS as regras usando paginacao automatica. Duas abordagens possiveis:

**Opcao A (preferida)**: Usar `.range()` com loop acumulador:
```typescript
const PAGE_SIZE = 1000;
let allData: EligibilityRule[] = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from('entity_eligibility_rules')
    .select('*')
    .eq('is_active', true)
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  allData = allData.concat(data || []);
  if (!data || data.length < PAGE_SIZE) break;
  from += PAGE_SIZE;
}
return allData;
```

**Opcao B (alternativa)**: Definir um `.limit()` explicito alto (ex: 5000) caso o volume nunca ultrapasse esse teto.

### Arquivo alterado

**`src/hooks/useEntityEligibilityRules.ts`** — funcao `useAllEligibilityRules` (linhas 49-62)

### Nao alterado
- Motor de cotacao (`usePlanosCotacao.ts`) — logica de filtragem esta correta
- Regras no banco — ja estao configuradas corretamente
- UI de cotacao

### Resultado esperado
Todas as 2.291+ regras serao carregadas e aplicadas. Planos Diesel serao descartados para veiculos nao-diesel. Planos Desagio serao descartados para veiculos sem placa especial.

