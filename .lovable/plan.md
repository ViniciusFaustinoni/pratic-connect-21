

# Plano: Remover aba "Regras" do modal de plano

## Contexto

A elegibilidade (regras de marca/modelo e faixa de ano) deve ser configurada apenas na Linha de Produto, não no Plano. O modal de plano tem uma aba "Regras" com `EligibilityRulesEditor` e `MarcaModeloExclusionEditor` que deve ser removida.

## Alterações em `PlanFormModal.tsx`

1. Remover o `TabsTrigger value="regras"` (linha 407)
2. Remover o `TabsContent value="regras"` inteiro (linhas 730-739)
3. Remover os imports de `EligibilityRulesEditor` e `MarcaModeloExclusionEditor` (linhas 34-35)

## Arquivo modificado

- `src/components/admin/planos/PlanFormModal.tsx`

