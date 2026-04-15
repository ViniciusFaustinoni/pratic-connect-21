

## Plano: Corrigir overflow do modal de elegibilidade e dropdown no mobile

### Problema

O `DialogContent` do modal de elegibilidade (`EligibilityRulesEditor.tsx`) não tem scroll nem altura adequada no mobile (390px viewport), cortando o conteúdo. O `SelectContent` do dropdown "Tipo de Regra" também sofre clipping dentro do modal.

### Correção

**Arquivo: `src/components/admin/planos/EligibilityRulesEditor.tsx`**

1. **Linha 301** — Adicionar `max-h-[85vh] overflow-y-auto` ao `DialogContent` para garantir scroll interno no mobile:
```tsx
<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
```

2. **Linha 314** — Adicionar `position="popper"` e `z-[1300]` ao `SelectContent` para evitar clipping pelo overflow do modal:
```tsx
<SelectContent position="popper" className="z-[1300]" sideOffset={4}>
```

3. Adicionar `onPointerDownOutside={(e) => e.preventDefault()}` ao `DialogContent` para evitar que interações com o Select fechem o modal.

