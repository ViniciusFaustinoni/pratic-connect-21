

# Fix: Uso Aplicativo não sendo salvo na cotação

## Problema

No `CotacaoFormDialog.tsx`, o estado `usoVeiculo` controla se o veículo é de aplicativo, mas esse valor **nunca é incluído no objeto `cotacaoData`** que é salvo no banco (linhas 1010-1065). Como resultado, `cotacoes.uso_aplicativo` fica sempre `null/false`, e quando o contrato é gerado a partir da cotação, herda esse valor incorreto.

## Solução

Adicionar `uso_aplicativo: usoVeiculo === 'aplicativo'` ao objeto `cotacaoData` em `CotacaoFormDialog.tsx` (linha ~1038, junto com os outros campos da cotação).

## Arquivo alterado

- `src/components/cotacoes/CotacaoFormDialog.tsx` — 1 linha adicionada no objeto `cotacaoData`

