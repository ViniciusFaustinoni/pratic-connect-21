

# Drag & Drop de Planos entre Linhas

## O que será feito
Permitir arrastar um plano de uma linha para outra na seção "Linhas e Planos" da Gestão Comercial. Ao soltar o plano em outra linha, seu `product_line_id` será atualizado no banco.

## Abordagem técnica

**Biblioteca**: Usar a API nativa de HTML5 Drag & Drop (sem dependência extra), já que a interação é simples — arrastar um item de uma lista para outra.

**Arquivo**: `src/components/gestao-comercial/LinhasPlanos.tsx`

### Mudanças:

1. **Novo hook `useMovePlanToLine`** — mutation que faz `UPDATE planos SET product_line_id = ? WHERE id = ?` e invalida a query.

2. **Estado de drag** — `draggedPlan: { id, fromLineId } | null` no componente principal.

3. **Nos itens de plano (linha ~260)** — adicionar `draggable`, `onDragStart` (setar estado) e `onDragEnd` (limpar estado). Cursor `grab`.

4. **Nas linhas (div da `Collapsible`, ~232)** — adicionar `onDragOver` (preventDefault + highlight visual) e `onDrop` (chamar mutation se linha destino ≠ linha origem). Abrir automaticamente a linha ao passar por cima.

5. **Feedback visual** — borda destacada (ex: `ring-2 ring-primary`) na linha quando um plano está sendo arrastado sobre ela.

## Impacto
- 1 arquivo alterado, ~40 linhas adicionadas
- Nenhuma dependência nova
- Apenas atualiza `product_line_id` — coberturas, benefícios e elegibilidade permanecem intactos

