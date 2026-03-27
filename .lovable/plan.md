

# Adicionar Duplicação em Coberturas e Benefícios

## Estado Atual

| Entidade | Hook de duplicação | Botão na UI |
|---|---|---|
| Planos | `useDuplicatePlan` ✅ | ✅ (PlanCard) |
| Linhas | `useDuplicateProductLine` ✅ | ✅ (LinhasTab) |
| Benefícios | `useDuplicateBenefit` ✅ | ❌ falta botão |
| Coberturas | ❌ não existe | ❌ falta botão |

## Alterações

### 1. `src/hooks/usePlansAdmin.ts`
- Criar `useDuplicateCobertura()` seguindo o padrão de `useDuplicateBenefit`: busca original na tabela `coberturas`, copia com nome `(cópia)`, `is_active: false`, invalida query `['coberturas']`

### 2. `src/components/admin/planos/BeneficiosTab.tsx`
- Importar `useDuplicateBenefit` e ícone `Copy`
- Adicionar botão de duplicar (ícone Copy) ao lado de Edit/Trash na coluna de ações

### 3. `src/components/admin/planos/CoberturasTab.tsx`
- Importar `useDuplicateCobertura` e ícone `Copy`
- Adicionar botão de duplicar ao lado de Edit/Trash na coluna de ações

