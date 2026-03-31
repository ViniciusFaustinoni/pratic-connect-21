

# Correção: Preços das faixas FIPE desalinhados na UI

## Problema identificado

Ao abrir uma cobertura "Lançamento" para edição, os preços das faixas FIPE aparecem errados na interface. A faixa R$ 50.000–55.000 mostra R$ 2,50 (valor da faixa 0–5k) em vez de R$ 13,75.

**Causa raiz**: Desalinhamento entre índices do banco e índices da UI.

- O banco armazena 36 faixas (0–180k), indexadas de 0 a 35. Index 0 = faixa 0–5k (valor 2.5), index 10 = faixa 50–55k (valor 13.75).
- A UI regenera as faixas a partir do `min` (50000), criando 26 faixas indexadas de 0 a 25.
- Ao carregar, `fipeValoresFaixa[0]` recebe o valor da primeira faixa do banco (2.5), mas a UI exibe o index 0 como 50k–55k.

## Correção

**Arquivo**: `src/components/gestao-comercial/EligibilityConfigSection.tsx`

**Mudança na carga dos dados (linhas 80-85)**: Em vez de indexar pelo índice do array (`i`), calcular o índice relativo da faixa com base no `min` e `intervalo` configurados:

```ts
// Antes (bugado):
cfg.faixas.forEach((f: any, i: number) => {
  if (f.valor != null) valMap[i] = String(f.valor);
});

// Depois (correto):
const cfgMin = cfg.min || 0;
const cfgIntervalo = cfg.intervalo || 5000;
cfg.faixas.forEach((f: any) => {
  if (f.valor != null && f.de != null) {
    const relativeIndex = Math.round((f.de - cfgMin) / cfgIntervalo);
    valMap[relativeIndex] = String(f.valor);
  }
});
```

Isso garante que a faixa 50k–55k (de=50000) seja mapeada para o índice 0 quando min=50000, alinhando com a geração visual.

**Mudança no salvamento (linhas 136-141)**: Ajustar para salvar também as faixas inativas (abaixo do min) preservando seus valores originais do banco, ou simplesmente gerar as faixas a partir do min configurado (comportamento atual já correto no save).

## Impacto
- Apenas 1 arquivo alterado, ~5 linhas modificadas
- Corrige a exibição de todas as coberturas Lançamento (e qualquer item cujo `min` > 0)
- Não altera dados no banco — apenas a forma como a UI lê os índices

