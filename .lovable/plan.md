
# Fix: Botao concluir sobreposto e scroll travado na manutencao

## Problema
O modal de resultado da manutencao (`ExecutarManutencao.tsx`) tem dois problemas no mobile:
1. O botao "Confirmar" fica sobreposto ao conteudo (fotos, descricao)
2. O scroll dentro do modal trava e o usuario nao consegue rolar

## Causa raiz
- O `DialogContent` base (dialog.tsx) ja aplica `max-h-[90vh] overflow-y-auto`
- O modal adiciona OUTRO `max-h-[90vh]` + `flex flex-col` por cima
- Dentro, ha um `ScrollArea` com `max-h-[calc(90vh-140px)]` criando scroll aninhado
- No mobile (iOS Safari), scroll aninhado com `ScrollArea` do Radix trava o touch scroll
- O footer com `flex-shrink-0` acaba ficando por cima do conteudo quando as alturas conflitam

## Solucao

### Arquivo: `src/pages/instalador/ExecutarManutencao.tsx`

1. **Remover o `ScrollArea`** — substituir por `div` com `overflow-y-auto` nativo, que funciona bem no mobile
2. **Ajustar o `DialogContent`** — usar `overflow-hidden` (nao auto) no container pai, e deixar apenas o div interno scrollar
3. **Garantir footer fixo** — usar layout flex correto para que o footer fique sempre visivel na parte inferior sem sobrepor

Mudancas especificas:

```text
Linha 452: DialogContent
  De: className="max-w-md max-h-[90vh] flex flex-col p-0"
  Para: className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden"

Linha 457: ScrollArea -> div
  De: <ScrollArea className="flex-1 max-h-[calc(90vh-140px)] px-4 overscroll-contain">
  Para: <div className="flex-1 overflow-y-auto px-4 overscroll-contain -webkit-overflow-scrolling-touch">

Linha 703: </ScrollArea> -> </div>

Remover import de ScrollArea (linha 18)
```

### Arquivo: `src/components/ui/dialog.tsx`

Nenhuma alteracao necessaria — o problema esta na composicao do modal, nao no componente base.

## Resultado esperado
- O conteudo do modal rola suavemente no mobile (touch scroll nativo)
- O footer com botoes "Cancelar" e "Confirmar" fica sempre visivel e fixo na parte inferior
- Sem sobreposicao de elementos
