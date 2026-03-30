

# Ordem de Anexação Independente do Checkbox "Anexar à Proposta"

## Problema

1. O campo **"Ordem de anexação"** (`ordem_anexo`) só aparece quando "Anexar à Proposta de Filiação" está marcado
2. Templates como o termo de rastreador são injetados **dinamicamente** quando `is_default_rastreador` está marcado, mas se o usuário também marca `anexar_proposta` para definir a posição, o termo vai **duplicado** no documento final
3. O usuário quer poder definir a posição/ordem do template na proposta **sem precisar marcar** `anexar_proposta`

## Solução

Tornar o campo `ordem_anexo` sempre visível (não condicionado ao `anexar_proposta`), e na geração da proposta, excluir templates que já serão injetados dinamicamente (como o de rastreador).

## Alterações

### 1. `src/pages/documentos/TemplateForm.tsx`

- Remover a condição `{form.watch('anexar_proposta') && ...}` que esconde o campo `ordem_anexo`
- Mostrar `ordem_anexo` sempre, com descrição atualizada: "Define a posição deste termo na proposta de filiação (menor número = aparece primeiro). Funciona tanto para anexos manuais quanto para termos injetados automaticamente (ex: rastreador)."

### 2. `src/hooks/useGerarProposta.ts` (~linha 388)

- Ao buscar templates com `anexar_proposta = true`, excluir os que têm `is_default_rastreador = true` (pois esses já são injetados condicionalmente pela lógica de negócios)
- Usar o `ordem_anexo` para ordenar **todos** os templates anexados (manuais + dinâmicos) de forma unificada

### 3. `supabase/functions/autentique-create/index.ts` e `supabase/functions/autentique-create-by-token/index.ts` (~linhas 529-534 e 499-503)

- Mesma lógica: ao buscar templates `anexar_proposta = true`, filtrar para excluir os que são `is_default_rastreador = true`, evitando duplicação
- Quando o rastreador for injetado dinamicamente, respeitar o `ordem_anexo` do template para posicioná-lo corretamente entre os demais anexos

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/documentos/TemplateForm.tsx` | Mostrar `ordem_anexo` sempre, sem depender de `anexar_proposta` |
| `src/hooks/useGerarProposta.ts` | Excluir templates `is_default_rastreador` da query de anexos; unificar ordenação |
| `supabase/functions/autentique-create/index.ts` | Idem — evitar duplicação do rastreador nos anexos |
| `supabase/functions/autentique-create-by-token/index.ts` | Idem |

