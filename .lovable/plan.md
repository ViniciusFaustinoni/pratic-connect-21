

# Remover regras de elegibilidade dos benefícios

## Correção

Regras de elegibilidade (FIPE, tipo de veículo, etc.) pertencem ao **Plano**, não ao benefício individual. O `EligibilityRulesEditor` foi adicionado incorretamente no BeneficioSheet.

## Alterações

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx` | Remover import e renderização do `EligibilityRulesEditor` do BeneficioSheet |
| `src/components/admin/planos/BeneficioFormModal.tsx` | Remover import e renderização do `EligibilityRulesEditor` |
| `src/components/rh/BeneficioFormModal.tsx` | Remover import e renderização do `EligibilityRulesEditor` |

Três arquivos, mesma correção: remover o bloco `EligibilityRulesEditor entityType="beneficio"` e o import associado.

As regras de elegibilidade continuam funcionando normalmente no **Plano** (`PlanFormModal.tsx` com `entityType="plano"`) e na **Linha** (`LinhaFormModal.tsx`).

