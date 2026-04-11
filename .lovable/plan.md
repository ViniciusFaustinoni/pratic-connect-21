

## Plano: Replicar elegibilidade do plano para coberturas e benefícios

### Problema
Ao configurar elegibilidade no plano, a regra fica apenas no plano. Precisa ser replicada automaticamente para todas as coberturas e benefícios do plano, **sobrescrevendo** regras existentes do mesmo tipo nos itens filhos.

### Solução

**1. Criar hook `src/hooks/useReplicateEligibilityToItems.ts`**

Hook com mutation que:
- Recebe `planId`
- Busca todos os `cobertura_id` de `planos_coberturas` e `beneficio_id` de `planos_beneficios` para o plano
- Busca todas as regras ativas do plano em `entity_eligibility_rules`
- Para cada regra do plano, replica via upsert (usando `useSaveRule` logic) para cada cobertura (`entity_type='cobertura'`) e benefício (`entity_type='beneficio'`)
- Deleta regras de tipos que foram removidos do plano nos itens filhos (sincronização completa)

Lógica principal:
```
1. Fetch plan rules (entity_type='plano', entity_id=planId)
2. Fetch cobertura_ids from planos_coberturas WHERE plano_id
3. Fetch beneficio_ids from planos_beneficios WHERE plano_id
4. For each child entity:
   a. Delete ALL existing eligibility rules for that entity
   b. Insert copies of each plan rule with the child's entity_id/entity_type
```

Isso garante sobrescrita total: as regras do plano substituem quaisquer regras anteriores nos itens.

**2. Editar `src/components/admin/planos/EligibilityRulesEditor.tsx`**

- Adicionar props opcionais: `onAfterSave?: () => void` e `onAfterDelete?: () => void`
- Chamar esses callbacks após save/delete com sucesso (nos `onSuccess` existentes)

**3. Editar `src/components/gestao-comercial/LinhasPlanos.tsx`**

- No modal de elegibilidade do plano, usar o novo hook
- Passar callbacks `onAfterSave` e `onAfterDelete` ao `EligibilityRulesEditor` que disparam a replicação
- Mostrar toast informando "Regras replicadas para X coberturas e Y benefícios"

### Comportamento esperado
- Ao salvar/excluir regra no plano → sobrescreve todas as regras de coberturas e benefícios com as do plano
- Edição individual posterior de cobertura/benefício é possível (modal dedicado já existe)
- Se usuário remove regra de uma cobertura específica após herdar do plano, na cotação/termo aquele item ficará sem restrição → alerta de não cobertura

### Arquivos
- **Novo**: `src/hooks/useReplicateEligibilityToItems.ts`
- **Editar**: `src/components/admin/planos/EligibilityRulesEditor.tsx` (callbacks)
- **Editar**: `src/components/gestao-comercial/LinhasPlanos.tsx` (integrar replicação)

