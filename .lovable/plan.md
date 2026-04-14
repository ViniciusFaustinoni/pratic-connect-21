

## Plano: Aumentar largura do modal e dropdowns de Edição de Linha de Produto

### Alterações

**1. `src/components/admin/planos/LinhaFormModal.tsx`** (linha 131)
- Mudar `max-w-2xl` para `max-w-4xl` no `DialogContent`, dando mais espaço ao modal.

**2. `src/components/admin/planos/VeiculosAceitosEditor.tsx`** (linha 178)
- Mudar o grid de `grid-cols-6` para um layout que dê mais espaço a Marca e Modelo. Usar `grid-cols-[2fr_2fr_1fr_1fr_1fr_auto]` para que Marca e Modelo ocupem o dobro de largura dos campos de ano/status.
- Aumentar a altura dos SearchableSelect de `h-8` para `h-9` para melhor legibilidade.

### Resultado
O modal ficará significativamente mais largo (~896px → ~1024px) e os campos Marca/Modelo terão proporcionalmente mais espaço, eliminando o texto truncado ("Sel...").

