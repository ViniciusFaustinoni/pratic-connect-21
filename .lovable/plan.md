

# Plano: Reordenar planos dentro da mesma linha via drag-and-drop

## Situação atual
O drag-and-drop existente **só move planos entre linhas**. Não é possível reordenar planos dentro da mesma linha. A coluna `ordem` já existe na tabela `planos` e a query já ordena por ela (`.order('ordem')`), mas nenhuma lógica atualiza esse campo.

## O que muda para o usuário
Ao arrastar um plano dentro da mesma linha, ele será reposicionado visualmente e a nova ordem será salva no banco. A ordem definida reflete em todas as interfaces que listam planos.

## Implementação

### 1. Novo hook `useReorderPlans` em `LinhasPlanos.tsx`
- Recebe `{ lineId, orderedPlanIds: string[] }`.
- Faz um batch update: para cada `planId` na lista, atualiza `ordem = index`.
- Invalida a query `linhas_com_planos_clean`.

### 2. Expandir lógica de drag-and-drop em `LinhasPlanos.tsx`
- Adicionar estado `dragOverPlanId` para rastrear sobre qual plano o cursor está.
- Nos itens de plano, adicionar handlers `onDragOver` e `onDrop`:
  - Se o plano arrastado pertence à **mesma linha**, reordenar localmente (mover o item na posição do alvo) e chamar `useReorderPlans`.
  - Se pertence a **outra linha**, manter o comportamento atual (`movePlan`).
- Mostrar indicador visual (linha separadora) na posição de inserção durante o drag.

### 3. Garantir `ordem` consistente
- Ao criar um novo plano, definir `ordem` como `MAX(ordem) + 1` da linha (já tratado no `PlanoFormSheet` — verificar e ajustar se necessário).

## Arquivos modificados
- `src/components/gestao-comercial/LinhasPlanos.tsx` — hook de reorder + lógica de drag within same line

