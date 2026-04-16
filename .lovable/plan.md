

## Plano: Normalizar acentos na comparação de marca/modelo

### Problema
A API FIPE retorna `CITROEN` (sem acento). As regras de elegibilidade cadastradas usam `CITROËN` (com trema). A comparação via `String.includes()` falha porque os caracteres são diferentes, bloqueando todos os planos para veículos Citroën (e potencialmente Peugeot com `PEUGEOT` vs acentos).

### Correção

**Arquivo:** `src/hooks/useEntityEligibilityRules.ts`

Na função `findModelEligibility` (linhas 180-187), adicionar normalização de diacríticos antes da comparação:

```typescript
function removeDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
```

Aplicar em:
- Linha 180: `const ctxMarca = removeDiacritics((ctx.marca || '').toUpperCase());`
- Linha 181: `const entryMarca = removeDiacritics((entry.marca || '').toUpperCase());`
- Linha 184: `const ctxModelo = removeDiacritics((ctx.modelo || '').toUpperCase());`
- Linha 185: `const entryModelo = removeDiacritics((entry.modelo || '').toUpperCase());`

Também aplicar no bloco legacy (linhas 269-275) para consistência.

Também corrigir na edge function `supabase/functions/_shared/eligibility-filter.ts` caso faça comparação de marca/modelo (verificar se aplica).

### Impacto
Correção cirúrgica — só adiciona normalização Unicode antes de comparar strings. Resolve Citroën e qualquer outra marca com acentos.

