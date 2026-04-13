

## Correção: Badge mostra min/max absoluto em vez do range sequencial das faixas FIPE

### Problema

O badge calcula `Math.min` e `Math.max` de **todos** os valores das faixas FIPE ativas, resultando em `R$ 43,70 ~ R$ 278,70`. Porém, ao abrir o modal, a primeira faixa (0-3k) tem valor `68,70` e a faixa de `43,70` está no meio (9k-12k). O badge mostra um range que não corresponde à leitura natural da tabela (primeira → última faixa).

### Correção

**Arquivo**: `src/components/gestao-comercial/LinhasPlanos.tsx` — linhas 670-674 (coberturas) e 715-719 (benefícios)

Trocar `Math.min/Math.max` por valor da **primeira** e **última** faixa ativa (ordenadas por `fipe_min`), que reflete o que o usuário vê ao abrir o modal:

```typescript
// Antes:
const minVal = Math.min(...activeFaixas.map((f: any) => f.valor));
const maxVal = Math.max(...activeFaixas.map((f: any) => f.valor));

// Depois:
const sorted = [...activeFaixas].sort((a: any, b: any) => (a.fipe_min ?? a.de ?? 0) - (b.fipe_min ?? b.de ?? 0));
const firstVal = sorted[0].valor;
const lastVal = sorted[sorted.length - 1].valor;
fipeRange = `R$ ${firstVal.toFixed(2).replace('.', ',')} ~ R$ ${lastVal.toFixed(2).replace('.', ',')}`;
```

Isso fará o badge mostrar `R$ 68,70 ~ R$ 278,70` (primeiro tier → último tier), que é exatamente o que aparece ao abrir o modal.

### Escopo
- 2 blocos alterados em 1 arquivo (coberturas + benefícios)
- Sem deploy de Edge Function

