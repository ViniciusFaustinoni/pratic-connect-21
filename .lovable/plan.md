

# Corrigir scroll do modal "Atribuir Fornecedores" para exibir Auto Centers

## Problema

O titulo "Auto Centers para Cotacao de Pecas" aparece, mas os cards dos auto centers ficam cortados logo abaixo. O auto center "FUSCAO PRETO JACAREPAGUA" existe no banco com status `ativo` e WhatsApp preenchido, confirmando que o problema e puramente de layout/scroll.

A correcao anterior (`min-h-0` no ScrollArea) nao foi suficiente porque o Radix ScrollArea Viewport interno usa `h-full` que depende de uma altura explicita no container pai.

## Causa raiz

O `DialogContent` base ja possui `max-h-[90vh] overflow-y-auto` nas classes internas do componente. A classe customizada `overflow-hidden` sobrescreve isso, mas o `ScrollArea` do Radix precisa que seu Viewport tenha uma altura real calculada. O `flex-1 min-h-0` sozinho nao garante isso sem que o Viewport do Radix tambem tenha as restricoes corretas.

## Solucao

Duas alteracoes complementares:

### 1. Remover `overflow-hidden` do DialogContent e usar altura fixa no ScrollArea

No `DialogContent` (linha 238), trocar a abordagem de `overflow-hidden flex flex-col` para garantir que o flex container funcione corretamente:

```tsx
// De:
<DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

// Para:
<DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
```

Usar `h-[90vh]` em vez de `max-h-[90vh]` da uma altura definida ao flex container, permitindo que `flex-1` calcule corretamente a altura do ScrollArea.

### 2. Adicionar altura maxima explicita ao ScrollArea como fallback

Garantir que o `ScrollArea` tenha uma restricao de overflow funcional:

```tsx
// De:
<ScrollArea className="flex-1 min-h-0 pr-4">

// Para:
<ScrollArea className="flex-1 min-h-0 overflow-hidden pr-4">
```

## Arquivo alterado

- `src/components/sinistros/AtribuirFornecedoresDialog.tsx` (2 linhas)
