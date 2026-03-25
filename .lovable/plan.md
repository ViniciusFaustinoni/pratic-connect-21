

# Corrigir scroll na página pública de cotação

## Problema

A página `CotacaoContratacao.tsx` (rota `/cotacao/:token`) usa `h-screen` que limita a altura ao viewport. Combinado com `overscroll-behavior-y: none` no `body`/`#root` global, o scroll por toque/roda do mouse não funciona — só a barra lateral de scroll responde.

O `h-screen` força a div a ter exatamente a altura da tela, e embora tenha `overflow-y-auto`, a interação de scroll por toque pode ser bloqueada pela combinação com as camadas `fixed inset-0` de fundo e a regra global de overscroll.

## Alteração

### 1. `src/pages/public/CotacaoContratacao.tsx` — Linha 314

Trocar:
```
h-screen public-premium-bg relative overflow-y-auto overflow-x-hidden overscroll-y-none
```
Por:
```
min-h-screen public-premium-bg relative overflow-x-hidden
```

Usar `min-h-screen` em vez de `h-screen` permite que o conteúdo cresça naturalmente e o scroll use o comportamento nativo do body (que já funciona), em vez de depender de um container com altura fixa.

### 2. `src/index.css` — Classe `public-premium-bg`

Adicionar `touch-action: pan-y` para garantir que o scroll por toque funcione em mobile:
```css
.public-premium-bg {
  /* ... gradientes existentes ... */
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}
```

1 arquivo de componente + 1 linha no CSS.

