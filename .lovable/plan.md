

## Plano: Corrigir erro "duplicate key violates unique constraint benefits_slug_key"

### Problema
Ao salvar um benefício no modal de edição, o campo `slug` é enviado no payload de update mesmo estando desabilitado no formulário. Como benefícios duplicados entre planos compartilham o mesmo slug, isso causa conflito de unicidade.

### Correção

**Editar**: `src/components/admin/planos/PlanBeneficiosList.tsx`

Remover `slug` do payload em `handleSave` (linha 72), já que o slug não deve ser alterado na edição inline:

```typescript
const payload = {
  id: benefit.id,
  name: form.name,
  // slug removido
  icon: form.icon || null,
  ...
};
```

### Arquivo
- **Editar**: `src/components/admin/planos/PlanBeneficiosList.tsx` (remover 1 linha do payload)

