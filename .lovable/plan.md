

# Diagnóstico: Filtro de planos ESPECIAL/SELECT em SP

## Investigação realizada

Analisei o fluxo completo de elegibilidade em `usePlanosCotacao.ts`, as tabelas de preços, as regras de elegibilidade (`plano_elegibilidade_modelos`), e os componentes de cotação (`Cotacao.tsx`, `Cotador.tsx`, `CotacaoFormDialog.tsx`).

## Causa raiz identificada

O filtro de elegibilidade é **idêntico para todas as regiões** — não há diferença de código entre RJ e SP. A lógica de whitelist funciona corretamente na teoria. Porém, encontrei **duas vulnerabilidades** que podem causar o problema:

### 1. Falha silenciosa quando dados de elegibilidade não carregam
Em `usePlanosCotacao.ts` (linha 480), se a query de `plano_elegibilidade_modelos` falhar (erro de rede, timeout), `elegibilidadeData` fica `undefined`. Nesse caso:
- `temRegrasElegibilidade = false` (pois `undefined?.some()` → `false`)
- O check de elegibilidade é **completamente ignorado**
- **Todos os planos aparecem sem filtro**

Esse é o cenário mais provável: um erro intermittente na query faz o filtro "desligar" silenciosamente.

### 2. Dados com `ano_max = NULL` na tabela ESPECIAL
Dois modelos na whitelist ESPECIAL têm `ano_max = NULL` (SONIC e STILO), aceitando qualquer ano >= 2002. Isso é provavelmente um erro de cadastro.

## Plano de correção

### Arquivo: `src/hooks/usePlanosCotacao.ts`

**Correção 1 — Tratar elegibilidadeData undefined como "tem regras" (fail-safe)**

Na verificação de `temRegrasElegibilidade` (linha 480), se `elegibilidadeData` for undefined (erro de carregamento), assumir que planos que possuem `product_line` com regras configuradas devem ser **negados** por precaução, em vez de aprovados.

```typescript
// ANTES (linha 480):
const temRegrasElegibilidade = elegibilidadeData?.some(e => planosNaLinhaIds.includes(e.plano_id)) ?? false;

// DEPOIS:
const temRegrasElegibilidade = elegibilidadeData === undefined
  ? true  // fail-safe: se dados não carregaram, assume que há regras → nega
  : elegibilidadeData.some(e => planosNaLinhaIds.includes(e.plano_id));
```

Isso garante que, se a query falhar, planos com elegibilidade configurada sejam **bloqueados** (não liberados).

**Correção 2 — Log de diagnóstico para depuração**

Adicionar console.warn quando `elegibilidadeData` estiver undefined, para facilitar debug futuro.

**Correção 3 — Incluir `isError` na verificação de dependências críticas**

Capturar o `isError` da query de elegibilidade e incluí-lo na lógica, para que erros de carregamento sejam tratados explicitamente.

### Arquivo: Dados no Supabase (verificação manual)

Os 2 registros com `ano_max = NULL` na tabela ESPECIAL (SONIC e STILO) devem ser corrigidos manualmente para ter `ano_max = 2004`, alinhado com as demais regras da linha.

## Resumo das alterações

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePlanosCotacao.ts` | Fail-safe para elegibilidadeData undefined + log de diagnóstico |

## Impacto

- Quando dados de elegibilidade carregam normalmente: comportamento idêntico ao atual
- Quando dados falham: planos com regras são **negados** (hoje são aprovados — o bug)
- Corrige o cenário onde SP (ou qualquer região) mostra planos indevidamente por falha de carregamento

