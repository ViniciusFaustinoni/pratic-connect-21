

# Corrigir decomposição hardcoded — useCotacao.ts e useCotacaoAvancada.ts

## PASSO 1 — Como usePlanosCotacao.ts faz

- Importa `useConfigDecomposicao` de `@/hooks/useConteudosSistema`
- Chama `const { data: decomposicao } = useConfigDecomposicao()` no corpo do hook (linha 72)
- Usa na linha 167-170:
  ```
  const decCota = decomposicao?.cota || 0.60;
  const decAdmin = decomposicao?.admin || 0.25;
  const decRastreamento = decomposicao?.rastreamento || 0.10;
  const decAssistencia = decomposicao?.assistencia || 0.05;
  ```
- Chaves da tabela `configuracoes`: `decomposicao_cota`, `decomposicao_admin`, `decomposicao_rastreamento`, `decomposicao_assistencia`

## PASSO 2 — Corrigir useCotacao.ts

**Problema**: `calcularValoresCotacao` é uma função pura (não-hook), chamada dentro do hook `useCalcularCotacao`. Não pode usar hooks diretamente.

**Solução**: 
1. Adicionar parâmetro opcional `decomposicao` à função `calcularValoresCotacao`
2. No hook `useCalcularCotacao` (linha 200), chamar `useConfigDecomposicao()` e passar o resultado para `calcularValoresCotacao`

```typescript
// Assinatura atualizada
export function calcularValoresCotacao(
  plano: PlanoParaCotacao,
  valorMensalDireto: number,
  valorFipe: number,
  decomposicao?: { cota: number; admin: number; rastreamento: number; assistencia: number },
)

// Dentro da função — usar valores do banco com fallback
const decCota = decomposicao?.cota || 0.60;
const decAdmin = decomposicao?.admin || 0.25;
const decRastreamento = decomposicao?.rastreamento || 0.10;
const decAssistencia = decomposicao?.assistencia || 0.05;
```

No hook `useCalcularCotacao`:
```typescript
const { data: decomposicao } = useConfigDecomposicao();
// ...
valores: calcularValoresCotacao(plano, faixaResult.valorMensal, valorFipe, decomposicao),
```

## PASSO 3 — Corrigir useCotacaoAvancada.ts

**Problema**: A decomposição está dentro de `queryFn` (async). Não pode usar hooks lá.

**Solução**: Buscar as 4 chaves de decomposição no mesmo `Promise.all` que já busca `adicional_app`:

```typescript
// Adicionar ao Promise.all existente (linha 81):
supabase
  .from('configuracoes')
  .select('chave, valor')
  .in('chave', ['decomposicao_cota', 'decomposicao_admin', 'decomposicao_rastreamento', 'decomposicao_assistencia']),
```

Depois, montar o objeto e usar nas linhas 147-150:
```typescript
const decMap = Object.fromEntries((decomRes.data || []).map(d => [d.chave, parseFloat(d.valor) || 0]));
const dec = {
  cota: decMap.decomposicao_cota || 0.60,
  admin: decMap.decomposicao_admin || 0.25,
  rastreamento: decMap.decomposicao_rastreamento || 0.10,
  assistencia: decMap.decomposicao_assistencia || 0.05,
};

const valorCota = Math.round(valorMensal * dec.cota * 100) / 100;
const taxaAdmin = Math.round(valorMensal * dec.admin * 100) / 100;
const valorAssist = Math.round(valorMensal * dec.assistencia * 100) / 100;
const valorRastreamento = Math.round(valorMensal * dec.rastreamento * 100) / 100;
```

## PASSO 4 — Busca global

Após as alterações, busca global por `0.60`, `0.25`, `0.10`, `0.05` para confirmar que nenhum hardcode de decomposição restou.

## Arquivos modificados
- `src/hooks/useCotacao.ts` — adicionar parâmetro + import `useConfigDecomposicao`
- `src/hooks/useCotacaoAvancada.ts` — buscar decomposição no `Promise.all`

