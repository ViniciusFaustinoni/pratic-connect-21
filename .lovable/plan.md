

# Plano: Adicionar tooltips informativos na área de Grades de Comissão

## Resumo

Adicionar tooltips (usando o componente `FieldHint` já existente no projeto) em todos os campos, áreas, e botões das telas de listagem e formulário de grades de comissão, tornando a interface mais intuitiva e autoexplicativa.

## 1. `src/pages/configuracoes/GradeComissaoForm.tsx`

Importar `FieldHint` de `@/components/admin/planos/FieldHint` e adicionar tooltips nos seguintes elementos:

| Local | Tooltip |
|-------|---------|
| Label "Nome da Grade" | "Identifique a grade de forma clara. Ex: 'Grade Agência Premium', 'Grade Vendedor Direto'." |
| Label "Descrição" | "Opcional. Use para detalhar o propósito ou público-alvo desta grade." |
| Título "Níveis de Comissão" | "Cada nível representa um participante na cadeia de vendas que recebe parte da taxa de adesão." |
| Botão "+ Adicionar Nível" | "Adicione um novo nível de comissionamento (ex: Vendedor, Supervisor, Agência)." |
| Campo nome do nível (placeholder) | "Nome do papel que recebe comissão. Ex: Vendedor Externo, Supervisor, Agência." |
| Campo percentual (%) | "Percentual da taxa de adesão destinado a este nível. O total de todos os níveis não pode ultrapassar 100%." |
| Setas de reordenação | "Altere a ordem de prioridade deste nível na grade." |
| Botão remover nível (lixeira) | "Remove este nível da grade." |
| Área "Total alocado" | "Soma de todos os percentuais. Pode ser menor que 100%, mas nunca maior." |
| Botão "Cancelar" | "Descarta alterações e volta para a lista de grades." |
| Botão "Criar/Salvar" | "Salva a grade com todos os níveis configurados." |

## 2. `src/pages/configuracoes/GradesComissao.tsx`

Importar `FieldHint` e `Tooltip` components. Adicionar tooltips nos botões de ação de cada card:

| Botão | Tooltip |
|-------|---------|
| Editar (Pencil) | "Editar os níveis e configurações desta grade" |
| Duplicar (Copy) | "Criar uma cópia desta grade com os mesmos níveis" |
| Ativar/Inativar (Power) | "Ativar ou inativar esta grade. Grades inativas não podem ser atribuídas a novos usuários." |
| Excluir (Trash2) | "Excluir esta grade. Só é possível se não estiver em uso." |
| Botão "+ Nova Grade" | "Criar uma nova grade de comissão do zero." |

Usar `Tooltip`/`TooltipContent`/`TooltipTrigger` de `@/components/ui/tooltip` para os botões de ícone, e `FieldHint` para labels de texto.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/configuracoes/GradeComissaoForm.tsx` | Tooltips em todos os campos e botões |
| `src/pages/configuracoes/GradesComissao.tsx` | Tooltips nos botões de ação dos cards |

