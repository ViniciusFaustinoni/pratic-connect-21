

## Plano: Edição Inline de Coberturas e Benefícios dentro do Modal de Plano

### Contexto
Hoje o modal de edição de plano (`PlanFormModal.tsx`) exibe coberturas e benefícios como listas de checkboxes do catálogo global. Com a migração para coberturas únicas por plano, cada cobertura/benefício pertence exclusivamente àquele plano e deve ser editável diretamente ali.

### O que muda

Substituir as duas seções `SearchableSelectionSection` (linhas 632-654 de `PlanFormModal.tsx`) por duas novas seções colapsáveis que mostram **apenas os itens já vinculados ao plano**, com capacidade de:

1. **Expandir cada item** (accordion/collapsible) para ver e editar todas as configurações:
   - Cobertura: nome, código, ícone, subtítulo, descrição, ordem, ativo, carência, regras de elegibilidade
   - Benefício: nome, slug, ícone, descrição, categoria, ordem, ativo, carência

2. **Criar novo item** — botão "Nova Cobertura" / "Novo Benefício" que abre o modal existente (`CoberturaUnificadaFormModal` / `BeneficioFormModal`), e ao salvar vincula automaticamente ao plano via `planos_coberturas` / `planos_beneficios`

3. **Excluir item do plano** — botão de lixeira que remove o vínculo em `planos_coberturas`/`planos_beneficios` e, como o item é exclusivo do plano, também exclui o registro da cobertura/benefício

4. **Salvar edições inline** — cada item editável salva individualmente via `useUpdateCobertura` / `useUpdateBenefit` (já existem), sem depender do botão "Salvar Plano"

### Componentes novos

**`src/components/admin/planos/PlanCoberturasList.tsx`**
- Recebe `planId` e carrega coberturas do plano via query em `planos_coberturas` com join em `coberturas`
- Renderiza lista de `Collapsible` items
- Cada item expandido mostra formulário inline (campos do `CoberturaUnificadaFormModal` embutidos) + `EligibilityRulesEditor`
- Botão "Nova Cobertura" abre `CoberturaUnificadaFormModal` em modo criação; ao criar, insere vínculo em `planos_coberturas`
- Botão de delete por item

**`src/components/admin/planos/PlanBeneficiosList.tsx`**
- Mesmo padrão para benefícios
- Carrega via `planos_beneficios` com join em `benefits`
- Formulário inline com campos do `BeneficioFormModal`
- Botão "Novo Benefício" → cria e vincula
- Botão de delete por item

### Alterações em `PlanFormModal.tsx`

- Remover as duas `SearchableSelectionSection` de coberturas e benefícios (linhas 632-654)
- Remover imports e states: `useBenefits`, `useCoberturas`, `benefitsSearch`, `coberturasSearch`, `selectedBenefits`, `selectedCoberturas`, `selectedBenefitIds`, `selectedCoberturaIds`, `filteredBenefits`, `filteredCoberturas`, `groupedBenefits`, `groupedCoberturas`, `toggleBenefit`, `toggleCobertura`
- Renderizar `<PlanCoberturasList planId={planId} />` e `<PlanBeneficiosList planId={planId} />` no lugar (só visíveis em modo edição)
- Remover `coberturas` e `benefits` do payload de `handleSubmit` (cada item salva individualmente agora)
- Para modo **criação** de plano: manter um estado temporário ou criar o plano primeiro e depois permitir adicionar itens (exibir mensagem "Salve o plano primeiro para adicionar coberturas e benefícios")

### Preview lateral
- Atualizar contadores no preview para usar dados das queries de cada lista em vez dos estados locais removidos

### Hooks existentes reutilizados
- `useCreateCobertura`, `useUpdateCobertura`, `useDeleteCobertura`
- `useCreateBenefit`, `useUpdateBenefit`, `useDeleteBenefit`
- `EligibilityRulesEditor` (já renderiza regras por entity)
- `CarenciaConfigSection` (já reutilizável)

### Arquivos alterados
- `src/components/admin/planos/PlanFormModal.tsx` — reestruturar seções de coberturas/benefícios
- `src/components/admin/planos/PlanCoberturasList.tsx` — novo componente
- `src/components/admin/planos/PlanBeneficiosList.tsx` — novo componente

### Não alterado
- `CoberturaUnificadaFormModal.tsx` — reutilizado como modal de criação
- `BeneficioFormModal.tsx` — reutilizado como modal de criação
- `EligibilityRulesEditor.tsx` — reutilizado inline
- `CarenciaConfigSection.tsx` — reutilizado inline
- Hooks CRUD — já existem
- Tabelas do banco — nenhuma migração
- Motor de cotação — não afetado

