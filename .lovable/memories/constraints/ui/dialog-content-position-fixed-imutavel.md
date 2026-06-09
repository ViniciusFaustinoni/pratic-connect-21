---
name: DialogContent position fixed imutável
description: DialogContent/AlertDialogContent nunca podem receber relative/absolute/static/sticky na className — tailwind-merge derruba o fixed da base e o modal desancorra do viewport
type: constraint
---

`src/components/ui/dialog.tsx > DialogContent` (e `AlertDialogContent`) começa a className base com `fixed left-[50%] top-[50%] … translate-x-[-50%] translate-y-[-50%]`. O helper `cn()` aplica `tailwind-merge`, que **deduplica utilitários da mesma categoria CSS** — `position` é uma só categoria.

Quando o consumidor passa `relative` (ou `absolute`/`static`/`sticky`) na própria `DialogContent`, o merge mantém **só o último** e **descarta `fixed`**. Resultado: `left:50%`/`top:50%` passam a se referenciar ao containing block ancestral (a barra/coluna onde o `<Dialog>` foi declarado), o modal aparece grudado em algum canto, header/overlay/footer escapam do viewport e não há backdrop escurecendo a tela.

**Não fazer:**
```tsx
<DialogContent className="max-w-md relative">  // ❌ derruba o fixed
```

**Fazer:** apenas tamanho/cor/padding/etc:
```tsx
<DialogContent className="max-w-md">           // ✅
```

Para ancorar overlays internos (loaders, máscaras de progresso), basta `absolute inset-0` no filho — `position: fixed` da própria `DialogContent` já serve de containing block para `position: absolute`:
```tsx
<DialogContent className="max-w-md">
  {loading && (
    <div className="absolute inset-0 z-20 …">  {/* ancora no DialogContent fixed */}
  )}
</DialogContent>
```

**Caso de referência:** `TrocaTitularidadeDialog.tsx` em 09/06/26 — modal abriu grudado na borda direita do header de `/vendas/cotacoes` porque a `DialogContent` tinha `relative` (originalmente colocado para o overlay de "Criando solicitação…"). Fix: remover `relative`. Não confundir com colisão entre dois Radix Dialogs — `setTimeout` para escalonar abertura é paliativo errado quando a causa real é tailwind-merge derrubando `position`.
