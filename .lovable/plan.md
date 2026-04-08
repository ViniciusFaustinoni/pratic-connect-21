

# Plano: Corrigir "Maximum update depth exceeded" no DialogContent

## Causa raiz

O componente `DialogContent` em `src/components/ui/dialog.tsx` (linha 34) usa `<DialogPortal>` que internamente cria um `Presence` wrapper. A composição de refs entre `Portal` → `Presence` → `Content` gera um loop infinito de `setState` via `setRef`. É o mesmo problema que já foi corrigido no `SelectContent` (remoção do Portal).

O stack trace confirma: `Presence` (chunk-HBQZEAXN) → `setRef` (chunk-E7TSFT4J) → `dispatchSetState` → loop.

## Correção

Em `src/components/ui/dialog.tsx`, remover o wrapper `<DialogPortal>` do `DialogContent`, renderizando `DialogOverlay` e `DialogPrimitive.Content` diretamente. O z-index alto (`z-[1100]`) já garante que o modal fique acima de todo o conteúdo, tornando o Portal desnecessário.

**Antes (linhas 33-50):**
```tsx
<DialogPortal>
  <DialogOverlay />
  <DialogPrimitive.Content ...>
    {children}
    <DialogPrimitive.Close .../>
  </DialogPrimitive.Content>
</DialogPortal>
```

**Depois:**
```tsx
<>
  <DialogOverlay />
  <DialogPrimitive.Content ...>
    {children}
    <DialogPrimitive.Close .../>
  </DialogPrimitive.Content>
</>
```

## Arquivo modificado

- `src/components/ui/dialog.tsx`

