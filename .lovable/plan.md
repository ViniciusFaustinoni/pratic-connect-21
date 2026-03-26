

# Revisao das Regras de Elegibilidade — Correcoes Pendentes

## Problemas Encontrados

### 1. BeneficioFormModal (produto) NAO foi atualizado
O arquivo `src/components/admin/planos/BeneficioFormModal.tsx` ainda usa o sistema antigo de exclusoes por categoria (linhas 278-312, com `benefit_category_exclusions`). O `EligibilityRulesEditor` foi adicionado apenas ao `BeneficioFormModal` de RH (`src/components/rh/`), que e uma entidade completamente diferente (beneficios de funcionarios, nao de planos).

O modal de beneficios de produto precisa:
- Substituir a secao "Excluir para Categorias Especiais" pelo `EligibilityRulesEditor`
- Manter o sistema antigo funcionando em paralelo por backward compatibility

### 2. Dados de categorias corretos
Os hooks estao corretos agora: