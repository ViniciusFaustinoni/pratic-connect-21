
# Sincronizar status de documentos entre tabelas

## Problema

Ao aprovar/reprovar um documento na fila de analise, apenas a tabela `documentos` e atualizada. A tabela `contratos_documentos` (que e a fonte de dados do painel "Documentacoes Anexadas") mantem o status como "pendente", causando inconsistencia visual.

## Causa raiz

A funcao `aprovarDocumento` em `src/hooks/useDocumentos.ts` atualiza somente a tabela `documentos`. O painel "Documentacoes Anexadas" (usado no detalhe do associado e na analise de proposta) le os dados de `contratos_documentos`, que nunca recebe a atualizacao de status.

## Solucao

Apos atualizar o status na tabela `documentos`, sincronizar o mesmo status na tabela `contratos_documentos` usando o `tipo` e o `associado_id` (ou `arquivo_url`) como criterio de match.

### Alteracoes

**Arquivo:** `src/hooks/useDocumentos.ts`

1. Na mutacao `aprovarDocumento` (linha ~295-303): apos o update em `documentos`, adicionar um update correspondente em `contratos_documentos` filtrando pela URL do arquivo ou pelo tipo + cotacao_id do associado.

2. Na mutacao `reprovarDocumento`: aplicar a mesma logica de sincronizacao.

### Detalhe tecnico

Na funcao `aprovarDocumento`, apos o update bem-sucedido em `documentos`, buscar o documento aprovado para obter a `arquivo_url` e entao atualizar `contratos_documentos`:

```typescript
// Apos aprovar em 'documentos', sincronizar com 'contratos_documentos'
const { data: docAprovado } = await supabase
  .from('documentos')
  .select('arquivo_url, tipo')
  .eq('id', id)
  .single();

if (docAprovado?.arquivo_url) {
  await supabase
    .from('contratos_documentos')
    .update({ status: 'aprovado' })
    .eq('arquivo_url', docAprovado.arquivo_url);
}
```

A mesma logica sera aplicada para `reprovarDocumento` (sincronizando status `reprovado`).

### Arquivos alterados

- `src/hooks/useDocumentos.ts` (mutacoes `aprovarDocumento` e `reprovarDocumento`)
