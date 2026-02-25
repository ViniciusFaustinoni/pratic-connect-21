
# Corrigir Erro "removeChild" ao Abrir Nova Cotacao

## Problema
Ao clicar em "Nova Cotacao" (seja pelo botao na pagina de Cotacoes ou pela acao rapida do Dashboard), a aplicacao crasha com o erro:
`Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.`

## Causa Raiz
O componente `CotacaoFormDialog` possui componentes baseados em portais (AlertDialog e PlacaDuplicadaModal) renderizados **dentro** do wrapper `<Dialog>` do Radix UI. Isso cria portais aninhados que conflitam com a reconciliacao do React 18 ao manipular o DOM.

Especificamente, nas linhas 1926-1973, o `AlertDialog` e o `PlacaDuplicadaModal` estao entre `</DialogContent>` e `</Dialog>` -- ainda filhos do `Dialog.Root`. Quando o React tenta montar/desmontar esses portais simultaneamente, perde o controle dos nos do DOM.

## Solucao
Reestruturar o `CotacaoFormDialog` para que os modais aninhados (AlertDialog de confirmacao e PlacaDuplicadaModal) sejam renderizados **fora** do `<Dialog>` principal, usando um Fragment como wrapper.

## Detalhes Tecnicos

### Arquivo: `src/components/cotacoes/CotacaoFormDialog.tsx`

**Mudanca 1:** Alterar o return do componente para usar Fragment e mover os modais para fora do Dialog:

De:
```tsx
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>...</DialogContent>
    {/* AlertDialog dentro do Dialog */}
    {showConfirmDialog && (<AlertDialog>...</AlertDialog>)}
    {/* PlacaDuplicadaModal dentro do Dialog */}
    {showPlacaDuplicadaModal && (<PlacaDuplicadaModal ... />)}
  </Dialog>
);
```

Para:
```tsx
return (
  <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>...</DialogContent>
    </Dialog>

    {/* Modais FORA do Dialog principal */}
    {showConfirmDialog && (<AlertDialog>...</AlertDialog>)}
    {showPlacaDuplicadaModal && (<PlacaDuplicadaModal ... />)}
  </>
);
```

Isso elimina o conflito de portais aninhados que causa o erro `removeChild`.

## Impacto
- Zero alteracao funcional -- ambos os modais continuam funcionando identicamente
- O Dialog principal abre/fecha normalmente
- Os modais de confirmacao e placa duplicada aparecem sobre o Dialog quando necessario
- Nenhuma outra pagina ou componente e afetado
