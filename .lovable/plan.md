
# Corrigir exibicao dos Auto Centers no modal "Atribuir Fornecedores"

## Problema

Os Auto Centers existem no banco de dados e sao retornados corretamente pela API, mas a secao "Auto Centers para Cotacao de Pecas" no modal fica cortada e nao e possivel rolar ate ela. O conteudo abaixo das oficinas nao aparece.

## Causa raiz

O componente `ScrollArea` (Radix) precisa de uma altura limitada para funcionar. Dentro de um `flex flex-col`, o elemento precisa de `min-h-0` para que o `flex-1` permita encolher e ativar o scroll interno do Radix. Sem `min-h-0`, o `ScrollArea` se expande alem do viewport e o conteudo fica cortado pelo `overflow-hidden` do DialogContent.

## Solucao

Adicionar `min-h-0` ao `ScrollArea` no arquivo `src/components/sinistros/AtribuirFornecedoresDialog.tsx` (linha 249).

### Alteracao

**Arquivo:** `src/components/sinistros/AtribuirFornecedoresDialog.tsx`

**Linha 249 - De:**
```
<ScrollArea className="flex-1 pr-4">
```

**Para:**
```
<ScrollArea className="flex-1 min-h-0 pr-4">
```

Isso permite que o flex item encolha abaixo do seu tamanho de conteudo, ativando o scroll interno do Radix ScrollArea e tornando toda a secao de Auto Centers visivel e rolavel.

## Arquivo alterado

- `src/components/sinistros/AtribuirFornecedoresDialog.tsx` (1 linha)
