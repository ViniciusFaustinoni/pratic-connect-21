

# Ordenacao de Templates Anexados a Proposta

## Problema
Os templates marcados com "Anexar a Proposta" sao ordenados por `nome` (alfabetico). O usuario precisa controlar a ordem em que esses documentos aparecem no PDF e no contrato Autentique.

## Solucao
Adicionar coluna `ordem_anexo` (integer, default 0) na tabela `documento_templates`. Usar essa coluna para ordenar os templates anexados em vez de ordenar por nome.

## Alteracoes

### 1. Migration SQL
```sql
ALTER TABLE documento_templates ADD COLUMN ordem_anexo integer DEFAULT 0;
```

### 2. `src/pages/documentos/TemplateForm.tsx`
Adicionar campo numerico "Ordem de anexacao" que aparece condicionalmente quando `anexar_proposta` esta ativo. Input numerico simples (0, 1, 2...) com descricao "Menor numero = aparece primeiro".

### 3. `src/hooks/useDocumentoTemplates.ts`
Incluir `ordem_anexo` nos tipos `DocumentoTemplateDB`, `CreateTemplateInput`, `UpdateTemplateInput` e nos mapeamentos de create/update.

### 4. Queries de anexacao — trocar `.order('nome')` por `.order('ordem_anexo')`
| Arquivo | Linha |
|---|---|
| `src/hooks/useGerarProposta.ts` | ~394 |
| `supabase/functions/autentique-create/index.ts` | ~477 |
| `supabase/functions/autentique-create-by-token/index.ts` | ~446 |

### 5. Lista de templates — indicador visual de ordem
Na listagem de templates (se houver), mostrar a ordem de anexacao como badge quando `anexar_proposta` esta ativo, para o usuario ter visibilidade.

## Arquivos editados

| Arquivo | Tipo |
|---|---|
| Migration SQL | Novo |
| `src/pages/documentos/TemplateForm.tsx` | Editado |
| `src/hooks/useDocumentoTemplates.ts` | Editado |
| `src/hooks/useGerarProposta.ts` | Editado |
| `supabase/functions/autentique-create/index.ts` | Editado |
| `supabase/functions/autentique-create-by-token/index.ts` | Editado |

