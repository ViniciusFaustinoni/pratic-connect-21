
# Plano: Validação Completa da Unificação de Tabelas (planos/plans)

## Diagnóstico Realizado

### Verificações Concluídas com Sucesso ✅

| Verificação | Resultado |
|-------------|-----------|
| Migração de dados comerciais para `planos` | 14 planos atualizados com `product_line_id`, `slug`, `badge_text`, etc. |
| Migração de `plan_benefits` → `planos_beneficios` | 147 registros migrados corretamente |
| VIEW de compatibilidade `vw_plans_compat` | Funcionando, retorna dados formatados |
| Hooks refatorados para usar `planos` | Sem queries diretas a `plans` ou `plan_benefits` |
| Integridade de FKs (cotações/contratos) | Todas as referências válidas |

### Problemas Identificados

| Problema | Impacto | Prioridade |
|----------|---------|------------|
| 1. Tipos em `src/types/plans.ts` referenciam tabelas deprecated | Pode causar erros de tipagem | Alta |
| 2. Plano "ELÉTRICOS" ativo sem `product_line_id` | Não aparece na UI de vendas | Média |
| 3. Interfaces `ProductLineWithPlans` e `PlansGroupedByLine` usam tipo `Plan` errado | Inconsistência de tipos | Baixa |
| 4. Tabelas `plans` e `plan_benefits` ainda existem no banco | Duplicação de dados | Baixa (não impacta runtime) |

## Correções Necessárias

### 1. Atualizar Tipos em `src/types/plans.ts`

**Problema**: Os tipos `Plan` e `PlanBenefit` ainda referenciam as tabelas deprecated.

**Solução**: Atualizar para usar a estrutura unificada:

```typescript
// ANTES (deprecated)
export type Plan = Tables<'plans'>;
export type PlanBenefit = Tables<'plan_benefits'>;

// DEPOIS (unificado)
export type Plan = Tables<'planos'>;
export type PlanBenefit = Tables<'planos_beneficios'>;

// Atualizar interfaces para usar PlanWithDetails
export interface ProductLineWithPlans extends ProductLine {
  plans: PlanWithDetails[];
}

export interface PlansGroupedByLine {
  productLine: ProductLine;
  plans: PlanWithDetails[];
}
```

### 2. Corrigir Plano "ELÉTRICOS" Órfão

**Problema**: O plano "ELÉTRICOS" (id: `ab31c6c6-2d01-4690-9507-3ea535b4a629`) está ativo mas:
- Não tem `product_line_id` (não aparece em nenhuma linha)
- Não tem benefícios associados
- Não tem `coverage_type` definido

**Opções de Solução**:

a) **Desativar temporariamente** até criar uma linha de produto para ele:
```sql
UPDATE planos SET ativo = false WHERE codigo = 'eletricos';
```

b) **Criar linha de produto "Veículos Elétricos"** e associar:
```sql
-- Criar linha de produto
INSERT INTO product_lines (name, slug, vehicle_type, icon, color, display_order)
VALUES ('Linha Elétricos', 'eletricos', 'car', '⚡', 'blue', 5);

-- Associar plano à nova linha
UPDATE planos 
SET product_line_id = (SELECT id FROM product_lines WHERE slug = 'eletricos')
WHERE codigo = 'eletricos';
```

### 3. Limpeza de Tipos Não Utilizados

**Arquivo**: `src/types/plans.ts`

Remover ou atualizar tipos deprecated que não são mais utilizados:
- `PlanBenefitWithDetails` → já existe `PlanBenefitItem` no hook

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/types/plans.ts` | Modificar | Atualizar tipos para usar tabela unificada |
| `configuracoes` (DB) | Decisão | Desativar ou criar linha para plano "ELÉTRICOS" |

## Validações Pós-Correção

Após aplicar as correções, validar:

1. **Área de Vendas** (`/vendas/planos-beneficios`):
   - Carrega planos por linha de produto
   - Exibe benefícios corretamente
   - Filtros funcionam (Carros/Motos)

2. **Área da Diretoria** (`/diretoria/planos-beneficios`):
   - CRUD de planos funciona
   - Benefícios são salvos em `planos_beneficios`
   - Duplicar/excluir planos funciona

3. **Cotações e Contratos**:
   - Seleção de planos continua funcionando
   - Dados históricos preservados

## Decisão Necessária

Para o plano "ELÉTRICOS", qual abordagem preferir?

**Opção A**: Desativar temporariamente (mais rápido)
**Opção B**: Criar nova linha de produto "Veículos Elétricos" (mais completo)

## Resumo das Alterações

```text
┌────────────────────────────────────────────────────────────────┐
│                    CORREÇÕES DE TIPOS                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  src/types/plans.ts                                            │
│  ├── Plan = Tables<'planos'>        (antes: Tables<'plans'>)  │
│  ├── PlanBenefit = Tables<'planos_beneficios'>                │
│  └── Interfaces atualizadas para PlanWithDetails              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    DADOS ÓRFÃOS                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Plano "ELÉTRICOS"                                             │
│  ├── Sem product_line_id                                       │
│  ├── Sem benefícios                                            │
│  └── Opção: Desativar ou criar linha de produto               │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Observações Técnicas

1. **Tabelas deprecated mantidas**: As tabelas `plans` e `plan_benefits` continuam no banco por segurança, mas não são mais usadas pelo código
2. **VIEW funcional**: `vw_plans_compat` permite rollback se necessário
3. **Sem breaking changes**: Todas as correções são retrocompatíveis
