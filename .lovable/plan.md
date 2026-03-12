

# Corrigir valor de adesão no link público (usar valor da cotação, não do plano)

## Problema

O valor de adesão mostrado no link público está vindo do valor fixo do plano (`planos.valor_adesao`, ex: R$ 199,90), em vez de usar o valor que o consultor definiu no campo "Taxa de Filiação" da cotação interna (`cotacoes.valor_adesao`). Esse campo é auto-preenchido com o valor do plano quando um plano é selecionado, mas o correto é calcular 1% do valor FIPE (mínimo R$ 100).

Há dois pontos de correção:

1. **Auto-cálculo**: Quando o valor FIPE é definido na cotação, o campo `valor_adesao` deve ser auto-preenchido com 1% da FIPE (mínimo lido de `configuracoes.taxas_procedimentos`), não com o valor fixo do plano
2. **Link público `/cotacao/:token`**: O valor de adesão exibido nos cards de plano (em `EscolhaPlano`) deve usar `cotacao.valor_adesao` da cotação interna, não o valor individual de cada plano

## Mudanças

### 1. Auto-calcular adesão (1% FIPE) em `CotacaoFormDialog.tsx`

Adicionar um `useEffect` que, quando `valor_fipe` muda, calcula `Math.max(valorFipe * 0.01, minimoAdesao)` e atualiza o campo `valor_adesao`. O valor mínimo será lido de `configuracoes` (chave `taxas_procedimentos`) ou fallback R$ 100.

Remover o auto-set de `valor_adesao` nas linhas 805 e 821 (quando plano é selecionado/removido), que sobrescreve o valor correto com o default do plano.

### 2. Garantir que `planos_comparacao` use o valor correto

Na hora de salvar a cotação (linha 1017), `form.getValues('valor_adesao')` já será o valor correto (1% FIPE) graças à mudança anterior. Nenhuma alteração necessária aqui.

### 3. Link público `/cotacao/:token` — usar valor da cotação

Em `useCotacaoContratacao.ts` (linhas 302-312), quando constrói `planosDisponiveis` a partir de `planos_comparacao`, o `valorAdesao` já vem do JSON gravado. **Mas** se o consultor editar o valor de adesão depois de criar a cotação, o `dados_extras` não é atualizado. 

Solução: Sobrescrever o `valorAdesao` de todos os planos com `cotacao.valor_adesao` (fonte de verdade), garantindo que o valor exibido é sempre o da cotação, não o snapshot do `dados_extras`.

```typescript
// useCotacaoContratacao.ts, linhas 302-312
return planosComparacao.map((p) => ({
  ...p,
  valorAdesao: cotacao.valor_adesao || p.valorAdesao, // Sempre usar valor da cotação
}));
```

### 4. Fallback da edge function `asaas-cobranca-adesao`

Corrigir a prioridade no fallback (linhas 118):
```typescript
// ANTES: prioriza plano
const valorPlano = cotacao?.planos?.valor_adesao || cotacao?.valor_adesao;
// DEPOIS: prioriza cotação (valor do consultor)
const valorPlano = cotacao?.valor_adesao || cotacao?.planos?.valor_adesao;
```

### 5. Hook público `useCalcularCotacao.ts` (fluxo `/q/:token`)

Neste fluxo independente (sem cotação interna), manter o cálculo de 1% FIPE como `valor_adesao` em vez do valor fixo do plano:

```typescript
// Linha 158
const valorAdesao = Math.max(params.valor_fipe * 0.01, minimoAdesao);
```

O `minimoAdesao` vem da query de `configuracoes` (`taxas_procedimentos`) já feita na linha 67.

## Arquivos impactados

- `src/components/cotacoes/CotacaoFormDialog.tsx` — auto-cálculo 1% FIPE, remover override por plano
- `src/hooks/useCotacaoContratacao.ts` — sobrescrever valorAdesao com cotacao.valor_adesao
- `src/hooks/useCalcularCotacao.ts` — calcular adesão como 1% FIPE (fluxo `/q/`)
- `supabase/functions/asaas-cobranca-adesao/index.ts` — corrigir prioridade do fallback

