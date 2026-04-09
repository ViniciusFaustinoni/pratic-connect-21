

## Plano: Expandir plano inline com coberturas/beneficios e modal de edicao

### Objetivo
Ao clicar num plano na lista de LinhasPlanos, expandir inline mostrando coberturas e beneficios com seus valores. Ao clicar num item, abrir o PlanFormModal focado nesse plano (onde ja existem os editores inline de coberturas e beneficios).

### Alteracoes

**1. Expandir dados na query `useLinhasComPlanos`** (`src/components/gestao-comercial/LinhasPlanos.tsx`)
- Alterar as queries de coberturas e beneficios para trazer nome e valor de cada item (nao so agregados)
- Coberturas: `planos_coberturas` → `select('plano_id, cobertura_id, coberturas(id, nome, valor, tipo, ativo)')`
- Beneficios: `planos_beneficios` → `select('plano_id, benefit_id, benefits:benefit_id(id, name, preco_sugerido, category, is_active)')`
- Armazenar listas completas por plano alem dos contadores/somas

**2. Adicionar estado de expansao por plano** (`src/components/gestao-comercial/LinhasPlanos.tsx`)
- Novo state `expandedPlanId: string | null`
- Clicar na linha do plano alterna expansao (toggle)
- Manter botoes de acao (editar, duplicar, excluir) no mesmo lugar

**3. Renderizar lista expandida inline**
- Abaixo da linha do plano expandido, mostrar:
  - Secao "Coberturas" com lista: nome + valor formatado (R$)
  - Secao "Beneficios" com lista: nome + preco_sugerido formatado (R$)
  - Cada item clicavel com cursor pointer e hover highlight
- Clicar num item abre `PlanFormModal` com `planId` do plano pai

**4. Abertura do modal ao clicar em item**
- Ao clicar em cobertura ou beneficio, chamar `setPlanoModal({ open: true, planId: plano.id, defaultLineId: linha.id })`
- O PlanFormModal ja possui PlanCoberturasList e PlanBeneficiosList com edicao inline completa

### Resultado
- Clique no plano → expande inline com coberturas e beneficios e valores
- Clique em qualquer item → abre modal de edicao do plano com dados pre-carregados
- Sem novos componentes — tudo dentro de LinhasPlanos existente

### Arquivo
- `src/components/gestao-comercial/LinhasPlanos.tsx`

