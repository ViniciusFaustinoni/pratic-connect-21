

# Atribuição de Planos a Regiões — Revisão e Plano

## Estado Atual

Existem **dois sistemas de gestão de planos** no projeto:

| Sistema | Componente | Regiões? |
|---|---|---|
| **Legado** | `PlanosConfig.tsx` + `usePlanosAdmin.ts` | ✅ Tem checkboxes de região, faz CRUD em `planos_regioes` |
| **Principal** (Gestão Comercial) | `PlanFormModal.tsx` + `usePlansAdmin.ts` | ❌ Não gerencia regiões |

A tabela `planos_regioes` **existe e está populada** (todos os planos vinculados a RJ, Lagos, SP). Porém o formulário principal (`PlanFormModal`) e os hooks modernos (`usePlansAdmin.ts`) **ignoram completamente** essa tabela.

Resultado: ao criar ou editar um plano pela Gestão Comercial, os vínculos de região não são criados nem atualizados.

## Alterações Necessárias

### 1. `src/hooks/usePlansAdmin.ts`
- Adicionar `regioes?: string[]` ao `PlanInput`
- Em `useCreatePlan`: após criar o plano, inserir vínculos em `planos_regioes`
- Em `useUpdatePlan`: deletar vínculos existentes e inserir novos
- Em `useDuplicatePlan`: copiar vínculos de região do plano original

### 2. `src/components/admin/planos/PlanFormModal.tsx`
- Importar `useRegioes` de `@/hooks/useRegioes`
- Adicionar estado `selectedRegioes: string[]` ao formulário
- Na aba "Básico", adicionar seção de checkboxes de regiões (similar ao que `PlanosConfig.tsx` já faz)
- No `handleSubmit`, passar `regioes` no payload
- No `useEffect` de reset, carregar regiões atuais do plano

### 3. `src/hooks/usePlans.ts` (query)
- Incluir `planos_regioes(regiao_id)` no select da query de planos para que a lista tenha os dados de região

### 4. `src/components/gestao-comercial/ProdutosPlanos.tsx`
- Exibir badge com contagem de regiões na listagem de planos (coluna ou badge inline)

### Sem mudanças no banco
A tabela `planos_regioes` já existe com a estrutura correta (`plano_id`, `regiao_id`, `ativo`). Não precisa de migration.

