

## Plano: Modal dedicado para edição de cobertura/benefício na lista de planos

### Problema
Ao clicar em uma cobertura ou benefício na lista de planos (LinhasPlanos), abre o PlanFormModal completo. O usuário quer um modal focado apenas no item clicado.

### Solução

Reutilizar os formulários inline já existentes (`CoberturaInlineForm` de `PlanCoberturasList.tsx` e `BeneficioInlineForm` de `PlanBeneficiosList.tsx`) dentro de modais standalone.

### Alterações

**1. Exportar os formulários inline existentes**
- Em `PlanCoberturasList.tsx`: exportar `CoberturaInlineForm`
- Em `PlanBeneficiosList.tsx`: exportar `BeneficioInlineForm`

**2. Editar `LinhasPlanos.tsx`**
- Adicionar estado para controlar modal de item: `editItemModal` com `{ open, type: 'cobertura'|'beneficio', item, planId }`
- No onClick das coberturas/benefícios, ao invés de abrir `PlanFormModal` com `focusItemId`, setar o `editItemModal` com os dados do item
- Adicionar dois novos `<Dialog>` simples que renderizam `CoberturaInlineForm` ou `BeneficioInlineForm` dentro de um DialogContent
- Ao salvar/fechar, invalidar queries e fechar modal

### Arquivos
- **Editar**: `src/components/admin/planos/PlanCoberturasList.tsx` (exportar `CoberturaInlineForm`)
- **Editar**: `src/components/admin/planos/PlanBeneficiosList.tsx` (exportar `BeneficioInlineForm`)
- **Editar**: `src/components/gestao-comercial/LinhasPlanos.tsx` (substituir onClick dos itens, adicionar modais dedicados)

