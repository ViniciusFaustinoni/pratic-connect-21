

# Corrigir valor de adesão para usar o que o consultor preencher

## Problema

O valor de adesão salvo na cotação vem sempre do campo fixo `planos.valor_adesao` do banco de dados. O consultor não consegue definir um valor customizado, especialmente no fluxo do Cotador.

### Causa raiz (3 pontos)

1. **`CriarCotacaoPayload`** não tem campo `valor_adesao` — impossível passar valor customizado
2. **`useCriarCotacao`** (linha 486) usa `resultado.valores.valor_adesao` que vem de `plano.valor_adesao` (valor fixo do plano)
3. **Cotador.tsx** não tem campo editável de adesão — exibe o valor do plano como read-only

O `CotacaoFormDialog` já permite edição e auto-calcula 1% FIPE, mas o valor não chega ao `useCriarCotacao` porque o payload não aceita esse campo.

## Mudanças

### 1. `src/types/cotacao.ts` — Adicionar campo ao payload

Adicionar `valor_adesao?: number` ao `CriarCotacaoPayload`.

### 2. `src/hooks/useCotacao.ts` — Priorizar valor do consultor

Linha 486: trocar de:
```
valor_adesao: resultado.valores.valor_adesao
```
para:
```
valor_adesao: payload.valor_adesao || resultado.valores.valor_adesao
```

E em `calcularValoresCotacao` (linha 210), substituir `plano.valor_adesao` por cálculo 1% FIPE (mínimo R$ 100) como default:
```
valor_adesao: Math.max(100, Math.round(valorFipe * 0.01 * 100) / 100)
```

### 3. `src/pages/vendas/Cotador.tsx` — Campo editável de adesão

- Adicionar estado `valorAdesaoCustom` inicializado com 1% FIPE ao calcular
- Exibir campo `Input` editável onde hoje mostra o valor fixo (linhas 1348-1349, 1444-1445)
- Passar `valor_adesao: valorAdesaoCustom` no payload de `criarCotacao.mutateAsync` (linha 628)
- Atualizar `dadosProposta` e texto WhatsApp para usar `valorAdesaoCustom`

### 4. `src/components/cotacoes/CotacaoFormDialog.tsx` — Guard contra sobrescrita

Adicionar ref `adesaoEditadaManualmente` para evitar que o `useEffect` (linha 274-281) sobrescreva o valor quando o consultor já editou manualmente o campo.

### Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/types/cotacao.ts` | `valor_adesao?: number` no payload |
| `src/hooks/useCotacao.ts` | Priorizar payload; default 1% FIPE |
| `src/pages/vendas/Cotador.tsx` | Estado editável + passar no payload |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Guard de sobrescrita |

