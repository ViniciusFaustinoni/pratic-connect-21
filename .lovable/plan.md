

# Plano: Remover aba "Elegibilidade" do modal de edição de plano

## Contexto

A aba "Elegibilidade" usa o componente `ElegibilidadeTab`, mas a aba "Regras" já contém o `EligibilityRulesEditor` que cobre a mesma funcionalidade. A aba é redundante.

## Alterações em `PlanFormModal.tsx`

1. **Remover o `TabsTrigger value="elegibilidade"`** (linha 482)
2. **Remover o `TabsContent value="elegibilidade"`** inteiro (linhas 809-815)
3. Verificar se `ElegibilidadeTab` é importado apenas aqui; se sim, remover o import

## Arquivo modificado

- `src/components/admin/planos/PlanFormModal.tsx`

