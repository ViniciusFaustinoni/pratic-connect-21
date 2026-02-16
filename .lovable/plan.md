
# Corrigir Duplicacao de Fotos nos Anexos do Regulador

## Problema

A secao "Anexos do Regulador" esta exibindo as fotos da auto-vistoria do associado junto com os documentos reais do regulador. Isso acontece porque na linha 810 do arquivo, os documentos sao combinados:

```
const todosDocumentos = [...documentos, ...extrairDocumentosDoLink(linkEvento)];
```

Porem, as fotos da auto-vistoria ja sao exibidas corretamente na secao "Fotos da Auto-Vistoria" logo acima. A funcao `extrairDocumentosDoLink` extrai fotos, B.O. e relatos do link do associado e os duplica na secao do regulador.

## Solucao

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

1. Na secao "Anexos do Regulador" (linha 810), remover a chamada a `extrairDocumentosDoLink` para mostrar apenas os documentos reais do regulador (`sinistro_documentos`):

```text
// ANTES (linha 810):
const todosDocumentos = [...documentos, ...extrairDocumentosDoLink(linkEvento)];

// DEPOIS:
const todosDocumentos = documentos;
```

2. No indicador de progresso da timeline (linha 1617), tambem ajustar para refletir apenas documentos do regulador:

```text
// ANTES (linha 1617):
(documentos.length + extrairDocumentosDoLink(linkEvento).length) > 0

// DEPOIS:
documentos.length > 0
```

## Resultado Esperado

- "Fotos da Auto-Vistoria": continua mostrando fotos, B.O. e relatos enviados pelo associado (sem alteracao)
- "Anexos do Regulador": mostra apenas documentos da tabela `sinistro_documentos` (documentos reais do regulador/analista)
- Sem duplicacao de fotos entre as secoes

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/SinistroAnalise.tsx` | Remover `extrairDocumentosDoLink` da secao "Anexos do Regulador" e do indicador de progresso |
