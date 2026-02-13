

# Corrigir erro "Could not find the 'updated_at' column" no upload de documentos

## Problema

Ao enviar documentos pelo link publico, a edge function `upload-documento-sinistro` falha com o erro:
```
Could not find the 'updated_at' column of 'sinistro_documentos' in the schema cache
```

## Causa raiz

A edge function tenta atualizar uma coluna `updated_at` na tabela `sinistro_documentos`, mas essa coluna nao existe na tabela.

Linha 91 do arquivo `supabase/functions/upload-documento-sinistro/index.ts`:
```typescript
.update({
  arquivo_url: urlData.publicUrl,
  status: 'enviado',
  updated_at: new Date().toISOString(), // <-- coluna inexistente
})
```

## Solucao

Remover a referencia a `updated_at` do update na tabela `sinistro_documentos`.

## Alteracao

| Arquivo | Descricao |
|---|---|
| `supabase/functions/upload-documento-sinistro/index.ts` | Remover `updated_at` do `.update()` na linha 91 |

### Detalhes tecnicos

O update passara a ser apenas:
```typescript
.update({
  arquivo_url: urlData.publicUrl,
  status: 'enviado',
})
```

A edge function sera reimplantada automaticamente apos a alteracao.

