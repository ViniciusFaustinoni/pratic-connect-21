

# Plano: Corrigir erro "Maximum update depth" nos modais de Cobertura e Beneficio

## Causa raiz

O componente `SelectContent` em `src/components/ui/select.tsx` usa `<SelectPrimitive.Portal>` que, quando renderizado dentro de um `<Dialog>` (Radix), causa um loop infinito de refs (`setRef` chama `setState` recursivamente). Isso afeta todos os modais que usam `Select` dentro de `Dialog`: `CoberturaUnificadaFormModal`, `BeneficioFormModal`, e o `AddRuleDialog` do `EligibilityRulesEditor`.

## Correção

### `src/components/ui/select.tsx`

Tornar o Portal condicional via prop `container`. Quando `container` for `null`, renderizar sem Portal (necessario dentro de Dialogs):

```tsx
const SelectContent = React.forwardRef<...>(
  ({ className, children, position = "popper", container, ...props }, ref) => {
    const content = (
      <SelectPrimitive.Content ref={ref} ...>
        ...
      </SelectPrimitive.Content>
    );
    
    if (container === null) return content;
    return <SelectPrimitive.Portal container={container}>{content}</SelectPrimitive.Portal>;
  }
);
```

Isso permite que os Selects dentro de Dialogs usem `<SelectContent container={null}>` para evitar o conflito de Portal, sem afetar os demais Selects do sistema.

### Arquivos que usam Select dentro de Dialog (adicionar `container={null}`)

- `src/components/admin/planos/CarenciaConfigSection.tsx` (1 Select)
- `src/components/admin/planos/BeneficioFormModal.tsx` (1 Select)
- `src/components/admin/planos/EligibilityRulesEditor.tsx` (1 Select no AddRuleDialog)

Alternativa mais simples: remover o `<SelectPrimitive.Portal>` inteiramente do `SelectContent`, ja que o z-index alto (`z-[1200]`) garante visibilidade sem Portal.

## Arquivos modificados

- `src/components/ui/select.tsx`

