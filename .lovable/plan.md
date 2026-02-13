

# Corrigir duplicacao de documentos ao solicitar documentos de sinistro

## Problema

Ao clicar em "Solicitar Documentos", o sistema insere registros na tabela `sinistro_documentos` sem verificar se ja existem documentos pendentes do mesmo tipo para aquele sinistro. Isso causa duplicacao na pagina publica de upload.

## Causa raiz

No arquivo `SolicitarDocumentosSinistroDialog.tsx`, linhas 82-93, o codigo faz um INSERT direto sem filtrar tipos ja existentes:

```typescript
const docsToInsert = documentosSelecionados.map(tipo => ({
  sinistro_id: sinistroId,
  tipo,
  ...
}));
await supabase.from('sinistro_documentos').insert(docsToInsert);
```

Alem disso, a edge function `criar-sinistro` tambem pode ter inserido documentos iniciais.

## Solucao

Antes de inserir, buscar os documentos ja existentes para o sinistro e filtrar os tipos que ja possuem registro, inserindo apenas os novos.

## Alteracao

| Arquivo | Descricao |
|---|---|
| `src/components/sinistros/SolicitarDocumentosSinistroDialog.tsx` | Adicionar consulta de documentos existentes antes do INSERT e filtrar duplicatas |

### Detalhes tecnicos

Dentro do `mutationFn`, antes do INSERT (linha 82), adicionar:

```typescript
// Buscar documentos ja existentes para este sinistro
const { data: existentes } = await supabase
  .from('sinistro_documentos')
  .select('tipo')
  .eq('sinistro_id', sinistroId);

const tiposExistentes = new Set((existentes || []).map(d => d.tipo));

// Filtrar apenas tipos que ainda nao existem
const tiposNovos = documentosSelecionados.filter(tipo => !tiposExistentes.has(tipo));

if (tiposNovos.length === 0) {
  // Todos ja existem, apenas atualizar status se necessario
  return;
}

const docsToInsert = tiposNovos.map(tipo => ({
  sinistro_id: sinistroId,
  tipo,
  nome_arquivo: TIPOS_DOCUMENTOS_SINISTRO.find(d => d.id === tipo)?.label || tipo,
  arquivo_url: '',
  status: 'pendente',
}));
```

Isso garante que cada tipo de documento apareca apenas uma vez por sinistro, mesmo que o analista clique em "Solicitar Documentos" varias vezes.

