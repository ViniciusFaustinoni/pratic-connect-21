

# Fix: Scroll bloqueado nas páginas públicas

## Causa raiz
CSS spec: `overflow-x: hidden` força `overflow-y: auto`, criando scroll containers aninhados involuntários. Combinado com `overscroll-behavior-y: none` no body/#root, os eventos de wheel/touch ficam presos e não propagam.

Cadeia de containers:
```text
body (overflow-x:hidden → overflow-y:auto, overscroll-behavior-y:none)
  └─ #root (overflow-x:hidden → overflow-y:auto)
      └─ page div (overflow-x-hidden → overflow-y:auto)  ← wheel event fica preso aqui
```

## Solução

### 1. Remover `overflow-x-hidden` do div raiz das páginas públicas
Nos arquivos de páginas públicas, remover a classe `overflow-x-hidden` do container principal. O `#root` já garante que não há overflow horizontal.

**Arquivos afetados:**
- `src/pages/public/CotacaoContratacao.tsx` — remover `overflow-x-hidden` do div raiz
- `src/pages/public/AcompanhamentoProposta.tsx` — idem, se presente

### 2. Ajustar CSS global para não criar scroll container no #root
Em `src/index.css`, trocar `overflow-x: hidden` no `body, #root` por `overflow: clip` que impede overflow sem criar scroll container (propriedade CSS moderna, suportada em todos browsers modernos).

```css
body,
#root {
  overflow-x: clip;   /* era: overflow-x: hidden */
  max-width: 100vw;
  overscroll-behavior-y: none;
}

html {
  overflow-x: clip;   /* era: overflow-x: hidden */
  max-width: 100vw;
}
```

`overflow: clip` corta o conteúdo excedente como `hidden`, mas **não cria um scroll container**, preservando a propagação natural de scroll.

### Arquivos editados
| Arquivo | Alteração |
|---------|-----------|
| `src/index.css` | `overflow-x: hidden` → `overflow-x: clip` em html, body, #root |
| `src/pages/public/CotacaoContratacao.tsx` | Remover `overflow-x-hidden` do div raiz |
| `src/pages/public/AcompanhamentoProposta.tsx` | Remover `overflow-x-hidden` do div raiz |

