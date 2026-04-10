

## Plano: Adicionar "Atribuir Existente" na lista de Benefícios do plano

### Problema
A lista de coberturas dentro da edição do plano possui dois botões: "Atribuir Existente" e "Nova Cobertura". A lista de benefícios possui apenas "Novo Benefício", sem opção de atribuir benefícios já existentes no catálogo.

### Alteração

**`src/components/admin/planos/PlanBeneficiosList.tsx`**

Replicar o padrão já implementado em `PlanCoberturasList.tsx`:

1. **Novos estados**: `assignOpen`, `assignSelected`, `assignSearch`, `assigning`

2. **Nova query** `beneficios-disponiveis-all`: Buscar todos os benefícios ativos com seus vínculos atuais (`planos_beneficios` + nome do plano), excluindo os já vinculados ao plano atual

3. **Função `handleAssign`**: 
   - Remover vínculos anteriores dos benefícios selecionados que já pertencem a outro plano
   - Inserir novos vínculos em `planos_beneficios` para o plano atual
   - Toast informando quantos foram vinculados/reatribuídos

4. **Botão "Atribuir Existente"** ao lado do "Novo Benefício" no header da seção

5. **Dialog de seleção** com:
   - Campo de busca por nome
   - Lista com checkboxes
   - Badge indicando plano atual para benefícios já vinculados a outro plano
   - Botão de confirmação com contador

### Resultado
- Benefícios existentes no catálogo podem ser atribuídos a um plano, igual às coberturas
- Benefícios de outros planos podem ser reatribuídos com indicação visual

### Arquivo
- `src/components/admin/planos/PlanBeneficiosList.tsx`

