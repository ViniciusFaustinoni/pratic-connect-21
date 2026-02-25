

# Melhoria UX: Campos empilhados na Cotacao Rapida

## Alteracao

No bloco "Dados do Associado" do formulario de Cotacao Rapida, os campos Telefone/WhatsApp e E-mail estao lado a lado em telas maiores (`md:grid-cols-2`). A melhoria e empilhar todos os campos verticalmente (um abaixo do outro).

## Detalhe tecnico

**Arquivo:** `src/components/cotacoes/CotacaoFormDialog.tsx` (linha 1020)

Alterar o container de `grid grid-cols-1 md:grid-cols-2 gap-3` para `space-y-3` (layout vertical puro), e remover o `md:col-span-2` do campo Nome que nao sera mais necessario.

Resultado: Nome, Telefone e Email ficam empilhados verticalmente, como mostrado na imagem de referencia.
