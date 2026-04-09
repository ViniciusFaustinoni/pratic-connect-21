

## Plano: Clicar em cobertura/beneficio abre modal com item expandido + criar coberturas no modal

### Problema
1. Clicar numa cobertura ou beneficio na lista expandida do plano abre o modal de edicao do plano, mas sem indicar qual item deve estar aberto para edicao
2. Ja e possivel criar coberturas no modal (botao "Nova Cobertura" existe em PlanCoberturasList), entao esse ponto ja esta resolvido

### Alteracoes

**1. `src/components/gestao-comercial/LinhasPlanos.tsx`**
- Adicionar campo `focusItemId` ao estado `planoModal`: `{ open: boolean; planId?: string; defaultLineId?: string; focusItemId?: string }`
- Nos clicks de cobertura (linha 540) e beneficio (linha 585), passar `focusItemId: cob.id` ou `focusItemId: ben.id`
- Propagar `focusItemId` como nova prop do `PlanFormModal`

**2. `src/components/admin/planos/PlanFormModal.tsx`**
- Adicionar prop `focusItemId?: string` na interface `PlanFormModalProps`
- Repassar `focusItemId` para `PlanCoberturasList` e `PlanBeneficiosList`

**3. `src/components/admin/planos/PlanCoberturasList.tsx`**
- Adicionar prop `focusItemId?: string` na interface
- No `useEffect`, se `focusItemId` estiver presente e corresponder a uma cobertura carregada, adicionar o ID ao `openItems` automaticamente (expandir o item)
- Fazer scroll ate o item com `scrollIntoView`

**4. `src/components/admin/planos/PlanBeneficiosList.tsx`**
- Mesma logica: prop `focusItemId`, auto-expandir e scroll ate o item

### Resultado
- Clicar em "Colisao - Select One Aplicativo" na lista abre o modal com o formulario dessa cobertura ja expandido
- Criar coberturas/beneficios ja funciona (botao existente)

### Arquivos
- `src/components/gestao-comercial/LinhasPlanos.tsx`
- `src/components/admin/planos/PlanFormModal.tsx`
- `src/components/admin/planos/PlanCoberturasList.tsx`
- `src/components/admin/planos/PlanBeneficiosList.tsx`

