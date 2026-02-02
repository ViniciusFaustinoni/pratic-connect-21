
# Plano: Unificação de Tabelas planos/plans - CONCLUÍDO ✅

## Status: Validação Completa Finalizada

### Correções Aplicadas ✅

| Tarefa | Status | Detalhes |
|--------|--------|----------|
| Atualizar tipos em `src/types/plans.ts` | ✅ Concluído | `Plan = Tables<'planos'>`, `PlanBenefit = Tables<'planos_beneficios'>` |
| Desativar plano "ELÉTRICOS" órfão | ✅ Concluído | Migração executada com sucesso |
| Interfaces atualizadas | ✅ Concluído | `ProductLineWithPlans` e `PlansGroupedByLine` usam `PlanWithDetails` |

### Estrutura Final

```text
┌─────────────────────────────────────────────────────────────────┐
│                    TABELA UNIFICADA: planos                     │
├─────────────────────────────────────────────────────────────────┤
│  • Fonte única de verdade para planos                           │
│  • Contém campos operacionais + comerciais                      │
│  • 13 tabelas dependentes com FKs válidas                       │
│  • Benefícios em: planos_beneficios                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TABELAS DEPRECATED                           │
├─────────────────────────────────────────────────────────────────┤
│  • plans (não mais usada pelo código)                           │
│  • plan_benefits (não mais usada pelo código)                   │
│  • VIEW vw_plans_compat mantida para rollback                   │
└─────────────────────────────────────────────────────────────────┘
```

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/types/plans.ts` | Tipos atualizados para usar tabelas unificadas |
| `src/hooks/usePlans.ts` | Refatorado para usar `planos` |
| `src/hooks/usePlansAdmin.ts` | Refatorado para usar `planos` |

### Observações de Segurança

Os alertas de segurança do linter são **pré-existentes** e não relacionados a esta migração:
- 8 views com SECURITY DEFINER (views antigas do sistema)
- Funções sem search_path definido (funções legadas)

Esses problemas devem ser tratados em uma tarefa separada de hardening de segurança.

## Próximos Passos Sugeridos

1. **Opcional**: Remover tabelas `plans` e `plan_benefits` após período de observação
2. **Opcional**: Criar linha de produto "Veículos Elétricos" e reativar plano
3. **Recomendado**: Corrigir alertas de segurança das views pré-existentes
