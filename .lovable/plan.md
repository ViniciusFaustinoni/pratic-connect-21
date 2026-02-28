
# Adicionar Fotos de Evidencia no Checklist do Instalador (itens NOK)

## Resumo

Quando o instalador marca um item do checklist como "Nao" (nok), alem da descricao ja existente, deve ser possivel anexar fotos de evidencia. O checklist deve permitir avanco mesmo com itens nok (desde que tenham descricao obrigatoria), e os itens nok devem influenciar a decisao final.

## Estado Atual

- **ChecklistItem** (`src/components/instalador/ChecklistItem.tsx`): Mostra botoes OK/NOK. Quando NOK, exibe textarea para observacao. **Nao tem upload de fotos.**
- **checklistCompleto**: Exige que TODOS os itens sejam 'ok' para avancar (linha 260-263). Isso bloqueia o avanco se qualquer item for 'nok'.
- **Decisao** (etapa 5): Ja tem aprovado/ressalva/negado com campos condicionais.

## Alteracoes

### 1. Componente ChecklistItem -- Adicionar upload de fotos

**Arquivo**: `src/components/instalador/ChecklistItem.tsx`

- Adicionar prop `fotos` (array de `{ preview: string }`) e callbacks `onAddFoto` / `onRemoveFoto`
- Quando status = 'nok', exibir area de upload de fotos abaixo do textarea (grid 3 colunas, ate 3 fotos)
- Botao de camera para capturar/selecionar foto
- Miniaturas com botao de remover

### 2. Estado de fotos por item no InstaladorChecklist

**Arquivo**: `src/pages/instalador/InstaladorChecklist.tsx`

- Expandir `ChecklistState` para incluir `fotos?: string[]` por item:
  ```text
  Record<string, { status: ChecklistStatus; observacao?: string; fotos?: string[] }>
  ```
- Adicionar funcoes `handleAddFotoChecklist(itemId, file)` e `handleRemoveFotoChecklist(itemId, index)` que fazem upload para o bucket `instalacoes` em `checklist/{servicoId}/{itemId}/`
- Passar as fotos e callbacks para cada `<ChecklistItem />`

### 3. Logica de avanco do checklist -- permitir NOK com evidencia

**Arquivo**: `src/pages/instalador/InstaladorChecklist.tsx`

Alterar `checklistCompleto` (linha 260):

De: todos devem ser 'ok'
Para: todos devem ser 'ok' **OU** 'nok' com observacao obrigatoria preenchida

```text
checklistItems.every(item => {
  const state = checklist[item.id];
  if (state?.status === 'ok') return true;
  if (state?.status === 'nok' && state.observacao?.trim()) return true;
  return false;
});
```

Nenhum item pode ficar 'pendente' para avancar.

### 4. Influencia na decisao final

Quando existem itens NOK no checklist, na etapa 5 (Decisao):

- Exibir um alerta informativo listando os itens marcados como NOK
- Se algum item for NOK, bloquear a opcao "Aprovado" (so permitir "Aprovado com Ressalva" ou "Negado")
- Pre-preencher o texto de ressalvas com os itens NOK e suas observacoes

### 5. Dados salvos no checklist_data

O `salvarChecklistMutation` ja salva o objeto `checklist` inteiro. Como vamos adicionar `fotos: string[]` ao state, as URLs das fotos serao persistidas automaticamente junto com o checklist no campo `checklist_data` do servico.

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/instalador/ChecklistItem.tsx` | Adicionar props e UI de fotos quando NOK |
| `src/pages/instalador/InstaladorChecklist.tsx` | Estado de fotos, upload, logica de avanco, influencia na decisao |

## Fluxo Resultante

1. Instalador marca item como NOK
2. Textarea de descricao aparece (obrigatorio)
3. Area de upload de fotos aparece (opcional mas recomendado)
4. Com todos itens OK ou NOK+descricao, pode avancar
5. Na etapa de Decisao, itens NOK sao listados e bloqueiam "Aprovado"
6. Se "Negado", abre modal de recusa com fotos obrigatorias (ja implementado)
