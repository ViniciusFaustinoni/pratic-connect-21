

# Exclusão permanente de cotações órfãs (somente Diretor)

## O que já existe
- Permissão `canDelete` no `cotacao` já restrita a `isDiretor || isSuperAdmin`
- Edge function `delete-cotacao` com check de `canDeleteCotacao`
- Dialog de confirmação simples (AlertDialog) sem exigir motivo
- Sorting já prioriza cotações sem lead (órfãs) no topo

## O que falta
1. **Filtro "Órfãs"** — não existe filtro para isolar cotações sem lead vinculado
2. **Exclusão em lote** — só é possível excluir uma por vez
3. **Dialog de confirmação robusto** — o atual não pede motivo (diferente do padrão de exclusão de sinistros/associados)

## Alterações

### 1. `Cotacoes.tsx` — Filtro de órfãs + seleção em lote

- Adicionar filtro "Sem Lead" no select de status ou como toggle separado visível apenas para diretores
- Adicionar estado `filtroOrfas` (boolean) e aplicar no `filteredCotacoes`: `!cotacao.lead_id`
- Adicionar checkboxes de seleção (visíveis quando `canDelete`) com estado `selectedIds: Set<string>`
- Botão "Excluir selecionadas" que abre dialog de confirmação com motivo obrigatório
- Trocar o AlertDialog simples por um dialog robusto com campo de motivo (reutilizar padrão do `ConfirmacaoExclusaoDialog`)

### 2. `Cotacoes.tsx` — Exclusão em lote

- Função `excluirEmLote` que itera sobre `selectedIds` chamando `excluirCotacao.mutateAsync` sequencialmente
- Progress feedback durante exclusão (toast com contador)
- Limpar seleção após conclusão

### 3. `CotacoesTable` — Checkboxes de seleção

- Adicionar prop `selectable`, `selectedIds`, `onToggleSelect`, `onToggleAll`
- Checkbox no header (selecionar todos visíveis) e em cada linha
- Visível apenas quando `canDelete` é true

### 4. Confirmação com motivo

- Criar `ConfirmacaoExclusaoCotacaoDialog` (ou reusar padrão existente) pedindo motivo obrigatório (mín 5 chars)
- Mostrar quantidade de cotações selecionadas e aviso de irreversibilidade

## Arquivos modificados
- `src/pages/vendas/Cotacoes.tsx` — filtro órfãs, seleção, lote, dialog
- `src/components/cotacoes/CotacoesTable.tsx` — checkboxes de seleção

## Resultado
- Diretor filtra cotações órfãs com 1 clique
- Seleciona várias e exclui em lote com motivo obrigatório
- Demais perfis não veem o filtro nem os checkboxes

