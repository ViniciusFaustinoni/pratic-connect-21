

# Plano: Exclusao por Marca/Modelo em Linhas e Planos

## Resumo

Adicionar uma secao dedicada "Exclusao por Marca e/ou Modelo" nos formularios de Linha (`LinhaFormModal`) e Plano (`PlanFormModal`). Usa a tabela `marcas_modelos` como fonte de dados. Se o plano define exclusoes proprias, elas sobrescrevem as da linha.

## Como funciona

Ja existe o sistema `entity_eligibility_rules` com `rule_type = 'marca_modelo'` e `rule_mode = 'exclude'`. Hoje o formulario e um input de texto livre. A mudanca e substituir por uma UI rica:

1. Switch "Ativar exclusao por marca/modelo"
2. Dropdown com busca de marcas (da tabela `marcas_modelos`, distintas)
3. Ao selecionar marca, ela aparece como chip/card com opcao "Adicionar modelos"
4. Se clicar em "Adicionar modelos", abre dropdown com busca dos modelos daquela marca
5. Se nenhum modelo selecionado = marca inteira excluida

Dados salvos como regras `entity_eligibility_rules` com:
- `rule_type: 'marca_modelo'`
- `rule_mode: 'exclude'`
- `rule_config: { marca: "BMW", modelos: ["X1", "X3"] }` (uma regra por marca)

## Banco de Dados

Nenhuma migration necessaria. O sistema `entity_eligibility_rules` ja suporta `marca_modelo` com `rule_config` JSON flexivel.

## Arquivos

### Criado

1. **`src/components/admin/planos/MarcaModeloExclusionEditor.tsx`**
   - Componente reutilizavel que recebe `entityType` + `entityId`
   - Carrega regras existentes do tipo `marca_modelo` + `exclude`
   - Switch para ativar/desativar
   - `SearchableSelect` para escolher marca (opcoes: `SELECT DISTINCT marca FROM marcas_modelos WHERE ativo = true`)
   - Ao selecionar marca: card com nome + botao "Excluir marca inteira" ou "Selecionar modelos"
   - Se "Selecionar modelos": `SearchableSelect` dos modelos daquela marca (`WHERE marca = X AND ativo = true`)
   - Modelos aparecem como badges removiveis
   - Salva/remove regras via `useSaveRule` / `useDeleteRule` do `useEntityEligibilityRules`
   - Badge visual: "Regra do Plano sobrescreve a Linha" quando `entityType === 'plano'`

### Modificados

2. **`src/components/admin/planos/LinhaFormModal.tsx`**
   - Adicionar `<MarcaModeloExclusionEditor entityType="linha" entityId={productLine?.id} />` abaixo do `EligibilityRulesEditor` existente (dentro do bloco `isEditing`)

3. **`src/components/admin/planos/PlanFormModal.tsx`**
   - Na tab "Elegibilidade" ou "Regras", adicionar `<MarcaModeloExclusionEditor entityType="plano" entityId={plan?.id} />`
   - Exibir aviso: "Se configurado aqui, sobrescreve a regra da Linha"

### Logica de sobrescrita

No motor de elegibilidade (consulta/cotacao), ao validar marca/modelo:
- Buscar regras `marca_modelo` + `exclude` do **plano**
- Se existirem → usar somente essas (ignora linha)
- Se nao existirem → buscar regras da **linha**

4. **Verificar/ajustar** o ponto de consumo dessas regras no fluxo de cotacao (provavelmente em `useDetectarTipoVeiculo.ts` ou no filtro de planos elegiveis) para implementar a logica plano > linha.

