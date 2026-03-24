

# Corrigir atalho "Nova Cotação" para abrir o modal de tipos

## Problema
O botão "Nova Cotação" no Dashboard navega para `/vendas/cotacoes?novo=true`. No `Cotacoes.tsx`, o parâmetro `novo=true` abre diretamente o formulário de cotação (`setShowCotacaoForm(true)`), pulando o modal `NovaEntradaDialog` que oferece as opções: nova cotação, migração, troca de titularidade, substituição, inclusão, etc.

## Solução
Uma alteração simples em `src/pages/vendas/Cotacoes.tsx`: no `useEffect` que lê o parâmetro `novo`, trocar `setShowCotacaoForm(true)` por `setShowNovaEntrada(true)`. Isso faz o atalho abrir o mesmo modal de seleção de tipo que o botão "Nova Cotação" da própria página de Cotações usa.

## Alteração

**Arquivo**: `src/pages/vendas/Cotacoes.tsx` (linhas 137-138)

Trocar:
```ts
} else if (novoParam === 'true') {
  setShowCotacaoForm(true);
```

Por:
```ts
} else if (novoParam === 'true') {
  setShowNovaEntrada(true);
```

Uma única linha alterada. O fluxo do `leadParam` (que vem do detalhe do lead) continua abrindo o formulário direto, pois já tem o lead vinculado.

