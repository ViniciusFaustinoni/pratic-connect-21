

## Remover botão "Adicionar associado"

Alterações no arquivo `src/pages/cadastro/Associados.tsx`:

1. **Remover o botão "Adicionar associado"** do empty state (linhas 663-668) — quando não há filtros ativos, mostrar apenas a mensagem sem botão de ação
2. **Remover o estado `formDialogOpen`** (linha 110) e o componente `AssociadoFormDialog` (linhas 950-953), já que não serão mais necessários
3. **Remover o import** do `AssociadoFormDialog` e do ícone `Plus` se não forem usados em outro lugar
4. **Atualizar a mensagem** do empty state para refletir que associados entram via cotação: "Associados são cadastrados automaticamente pelo fluxo de cotação"

