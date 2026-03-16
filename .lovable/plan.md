

## Plano: Corrigir Truncamento de Texto (UI + PDF)

### Problema

1. **UI (Cotador)**: Coberturas como "Rastreador/Monitorament..." cortadas pelo CSS `truncate` nos cards de plano
2. **UI (Cards)**: Nome do plano + badges "Restrições"/"Recomendado" transbordam o card (sem `min-w-0`/`overflow`)
3. **PDF**: `truncateText(cobertura, 32)` corta textos longos — coluna de ~80mm comporta ~45 chars em fonte 9px

### Correções

#### 1. `src/components/cotacoes/CotacaoFormDialog.tsx`

**Nome do plano overflow (L1798-1800):**
- Adicionar `min-w-0` no container flex e `truncate` no `<h4>` para que o nome não empurre badges para fora

**Coberturas truncadas (L1825-1856):**
- Remover `truncate` de todos os `<span>` de cobertura (L1829, 1835, 1849, 1855)
- Trocar `items-center` por `items-start` nos `<li>` para alinhar ícone ao topo quando texto quebra linha

#### 2. `src/components/planos/PlanoCardSelecao.tsx`

- L99: Trocar `items-center` por `items-start`
- L105, L111: Remover `truncate` dos spans de cobertura

#### 3. `src/lib/gerarPdfCotacao.ts`

**Cards compactos (L776-778):** Reduzir divisor de 2.2 para 1.8 no cálculo de `maxChars` para modo normal:
```
: Math.floor((width - padding * 2 - 8) / 1.8);
```

**Página de detalhe (L1190, 1206, 1235, 1252):** Aumentar limite de 32 para 45 caracteres em todas as 4 ocorrências de `truncateText(cobertura/item, 32)`.

### Arquivos afetados

- `src/components/cotacoes/CotacaoFormDialog.tsx` — overflow nome + truncate coberturas
- `src/components/planos/PlanoCardSelecao.tsx` — truncate coberturas
- `src/lib/gerarPdfCotacao.ts` — limites de caracteres no PDF

