

# Corrigir duplicidade de planos Aplicativo na cotação

## Problema raiz

Existem **planos duplicados** no banco: os planos principais (ex: SELECT EXCLUSIVE, tipo_uso='passeio', visivel_gestao=true) e variantes "aplicativo" (ex: SELECT EXCLUSIVE APLICATIVO, tipo_uso='aplicativo', visivel_gestao=false). Ambos têm `adicional_mensal=60`.

Quando o consultor marca "uso para aplicativo", o filtro mostra **apenas** as variantes aplicativo. O motor de preço busca o valor `particular` da tabela (ex: R$ 344,00 para FIPE ~72k), soma `adicional_app` (R$ 35,90) = R$ 379,90, e depois soma `adicional_mensal` (R$ 60) = **R$ 439,90** -- exatamente o valor errado da screenshot.

O valor correto seria: R$ 344,00 (base particular) + R$ 35,90 (adicional app) + R$ 60,00 (adicional do nível Exclusive) = R$ 439,90... mas exibido como "SELECT EXCLUSIVE" e não "SELECT EXCLUSIVE APLICATIVO".

Na verdade, o preço está correto matematicamente, mas o **plano exibido está errado** -- deveria mostrar o plano principal (SELECT EXCLUSIVE) com preço de app, não uma variante separada chamada "SELECT EXCLUSIVE APLICATIVO".

## Solução

Os planos com `visivel_gestao=false` e `tipo_uso='aplicativo'` são variantes internas que **não devem aparecer na cotação**. O motor de preço já sabe calcular o valor app usando o plano principal.

### 1. `usePlanosCotacao.ts` (2 alterações)

**Filtro de planos** (linhas 244-247): Substituir o filtro por tipo_uso por um filtro que exclui variantes internas:
```typescript
// ANTES: filtra por tipo_uso aplicativo/passeio
if (params.usoApp === true && !isPlanoAplicativo) continue;
if (params.usoApp === false && isPlanoAplicativo) continue;

// DEPOIS: sempre excluir variantes internas (aplicativo)
// O preço app é resolvido pelo motor de pricing nos planos principais
if (isPlanoAplicativo) continue;
```

**Resolução de tipoUso para pricing** (linha 316): Usar `usoApp` do params como fonte de verdade, não o mapping:
```typescript
// ANTES
const tipoUsoOriginal = mapping?.tipo_uso || (params.usoApp ? 'aplicativo' : 'particular');

// DEPOIS: usoApp do usuário tem prioridade
const tipoUsoOriginal = params.usoApp ? 'aplicativo' : (mapping?.tipo_uso || 'particular');
```

### 2. `useCalcularCotacao.ts` (mesmas 2 alterações)

Mesma lógica: excluir planos aplicativo do loop, e usar `params.tipo_uso` como fonte de verdade para pricing.

### Resultado
- Consultor marca "uso para aplicativo" → vê SELECT BASIC, SELECT EXCLUSIVE, SELECT ONE etc. (planos principais)
- Preços calculados com adicional app correto via `resolverPrecoApp`
- Nenhum plano com nome "APLICATIVO" aparece na cotação
- Variantes internas continuam no banco para uso administrativo (visivel_gestao=false)

