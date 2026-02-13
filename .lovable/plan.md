

# Corrigir botao "Analisar" que sumiu para sinistros em analise

## Problema

Na listagem de sinistros (`SinistrosList.tsx`, linha 430), o botao "Analisar" so aparece quando `sinistro.status === 'comunicado'`. Apos o sinistro ser aprovado para analise (status muda para `em_analise`), o botao desaparece, impedindo o diretor de acessar a tela de analise.

## Solucao

Alterar a condicao na linha 430 para incluir tambem o status `em_analise`:

```
sinistro.status === 'comunicado' || sinistro.status === 'em_analise'
```

## Alteracao

| Arquivo | Descricao |
|---|---|
| `src/pages/eventos/SinistrosList.tsx` (linha 430) | Expandir condicao do botao "Analisar" para incluir status `em_analise` |

Apenas uma linha precisa ser alterada. O restante do comportamento (permissao de diretor, navegacao) permanece identico.
