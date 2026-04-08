

# Plano: Remover aba "Cotas" do modal de edição de plano

## Contexto

A aba "Cotas" contém 3 campos: Preço Adicional, Desconto Promocional e Cota de Participação por Categoria. Esses campos devem ser redistribuídos para outras abas antes de remover a aba.

## Alterações em `PlanFormModal.tsx`

1. **Remover o `TabsTrigger` de "cotas"** (linha 481)
2. **Remover o `TabsContent value="cotas"`** inteiro (linhas 706-796)
3. **Mover os campos para a aba "Básico"**:
   - "Preço Adicional (R$)" e "Desconto Promocional (%)" vão para o final da aba Básico
   - "Cota de Participação por Categoria" (dinâmica baseada nas categorias selecionadas) também vai para a aba Básico, logo abaixo das categorias de veículo

Nenhuma lógica de estado ou persistência muda — apenas a localização visual dos campos.

## Arquivo modificado

- `src/components/admin/planos/PlanFormModal.tsx`

