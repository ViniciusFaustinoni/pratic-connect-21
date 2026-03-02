

# Fix: Botao "Proximo" travado quando ha itens NOK

## Causa Raiz

O Dialog de confirmacao de itens NOK (linhas 1812-1902) esta **dentro** do bloco condicional `{etapaAtual === 5 && (...)}`. Isso significa que ele so e renderizado quando o instalador esta na etapa 5 (Decisao).

Porem, o dialog precisa aparecer na **etapa 2** (Checklist), quando o instalador clica "Proximo" com itens NOK marcados. O fluxo atual:

1. Instalador esta na etapa 2 e marca itens como NOK
2. Clica "Proximo" -- funcao `avancar()` detecta `temItensNok` e faz `setShowDialogCondicao(true)`
3. O Dialog NAO aparece porque ele so existe dentro do bloco da etapa 5
4. O `return` na funcao `avancar()` impede o avanco
5. O instalador fica travado -- o botao "funciona" (nao esta disabled), mas nada acontece

## Correcao

### Arquivo: `src/pages/instalador/InstaladorChecklist.tsx`

Mover o bloco do Dialog de confirmacao (Dialog + ModalRecusaVeiculoComFotos relacionado ao NOK) para **fora** de qualquer bloco condicional de etapa, colocando-o no nivel raiz do componente (antes do footer de navegacao). Assim ele sera renderizado independentemente da etapa atual e aparecera corretamente quando `showDialogCondicao` for `true` na etapa 2.

Concretamente:
- Extrair o `Dialog open={showDialogCondicao}` (linhas 1812-1902) de dentro do bloco `etapaAtual === 5`
- Coloca-lo logo antes do footer de navegacao (antes da linha 1908), fora de qualquer condicional de etapa

Apenas 1 arquivo editado. Nenhuma migration necessaria.
