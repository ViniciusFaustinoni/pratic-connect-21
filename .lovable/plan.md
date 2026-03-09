

# Correção: Ações Rápidas cortadas no mobile

## Problema
A seção "Ações Rápidas" no Dashboard usa `flex` horizontal sem overflow ou wrap. No mobile (tela estreita), os botões ficam cortados e não há como acessá-los sem girar o dispositivo.

## Causa
Em `src/pages/Dashboard.tsx`:
- Linha 433: container usa `flex items-center gap-4` sem wrap
- Linha 437: `flex gap-3 flex-1` sem overflow-x-auto
- Linha 266: QuickActions também usa `flex gap-3` sem wrap

O título "Ações Rápidas" e os botões ficam na mesma linha, sem quebra.

## Correção

**Arquivo**: `src/pages/Dashboard.tsx`

1. **Mudar layout para empilhado no mobile**: O título fica em cima e os botões embaixo, com `flex-wrap` para que caibam em telas pequenas.

Alterações:
- Linha 433: trocar `flex items-center gap-4` por `flex flex-col sm:flex-row sm:items-center gap-3`
- Linha 437: adicionar `flex-wrap` ao container dos botões
- Linha 266 (QuickActions): adicionar `flex-wrap` ao `div`

