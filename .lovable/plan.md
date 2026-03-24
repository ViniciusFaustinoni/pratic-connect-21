

# Fix: Scroll não funciona nas páginas públicas de cotação

## Problema

As páginas públicas `/cotacao/:token` e `/q/:token` não permitem scroll (desktop e mobile). O conteúdo que excede a viewport fica inacessível.

## Causa raiz

A combinação de estilos globais no `index.css` (linhas 177-183) aplica `overscroll-behavior: none` ao `html`, `body` e `#root`. Em conjunto com a camada de background `fixed inset-0 overflow-hidden` presente nas páginas públicas, o scroll natural do body é comprometido em certos browsers (especialmente mobile Safari e Chrome mobile).

## Correção

### 1. `src/pages/public/CotacaoContratacao.tsx` — Tornar a página explicitamente scrollável

Envolver o conteúdo em um container com scroll explícito:

```tsx
// Linha 314: trocar
<div className="dark min-h-screen public-premium-bg relative">

// Para
<div className="dark min-h-screen public-premium-bg relative overflow-y-auto overflow-x-hidden">
```

### 2. `src/pages/public/CotacaoPublicaCompleta.tsx` — Mesma correção

```tsx
// Linha 639: trocar
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

// Para
<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 overflow-y-auto overflow-x-hidden">
```

### 3. `src/index.css` — Remover `overscroll-behavior: none` do `html`

O `overscroll-behavior: none` no `html` pode bloquear o scroll chain em browsers mobile. Manter apenas no `body` (para prevenir pull-to-refresh) e remover do `html` e `#root`:

```css
/* Linhas 176-183: trocar */
html,
body,
#root {
  overflow-x: hidden;
  max-width: 100vw;
  overscroll-behavior: none;
}

/* Para */
html {
  overflow-x: hidden;
  max-width: 100vw;
}

body,
#root {
  overflow-x: hidden;
  max-width: 100vw;
  overscroll-behavior-y: none;
}
```

Usar `overscroll-behavior-y` (eixo Y apenas) no `body` e `#root` permite scroll normal enquanto previne pull-to-refresh. Remover do `html` evita conflito na cadeia de scroll.

### 4. CSS safeguard para páginas públicas (index.css)

Adicionar regra específica para garantir scroll nas páginas públicas:

```css
.public-premium-bg {
  /* ... estilos existentes ... */
  -webkit-overflow-scrolling: touch;
}
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/index.css` | Editar — ajustar overscroll-behavior |
| `src/pages/public/CotacaoContratacao.tsx` | Editar — adicionar overflow-y-auto |
| `src/pages/public/CotacaoPublicaCompleta.tsx` | Editar — adicionar overflow-y-auto |

