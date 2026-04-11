

## Plano: Corrigir regras de elegibilidade duplicadas

### Problema
O `useSaveRule` sempre faz INSERT sem verificar se já existe uma regra do mesmo tipo para a mesma entidade. Isso gerou **23 coberturas** com `tipo_placa` duplicado e **1 plano** com `regiao` duplicado.

### Correção

**1. Migration SQL — limpar duplicatas existentes**

Deletar a regra mais antiga quando houver duplicatas (manter a mais recente):

```sql
DELETE FROM entity_eligibility_rules
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, entity_type, rule_type 
      ORDER BY created_at DESC
    ) as rn
    FROM entity_eligibility_rules
    WHERE is_active = true
  ) sub
  WHERE rn > 1
);
```

**2. Editar `src/hooks/useEntityEligibilityRules.ts` — upsert ao invés de insert**

Alterar `useSaveRule` para fazer upsert: antes de inserir, verificar se já existe uma regra ativa com o mesmo `(entity_id, entity_type, rule_type)`. Se existir, atualizar o `rule_config` e `rule_mode` da existente em vez de criar uma nova.

### Arquivos
- **Migration SQL**: limpar duplicatas
- **Editar**: `src/hooks/useEntityEligibilityRules.ts` (useSaveRule → upsert logic)

