
# Corrigir Checklist "Documentos anexados" mostrando como não concluído

## Problema

O checklist de análise verifica apenas `documentos.length > 0`, onde `documentos` vem exclusivamente da tabela `sinistro_documentos`. Porém, os documentos enviados pelo associado via link do evento (fotos da auto vistoria, B.O., etc.) ficam armazenados nos campos JSON do `sinistro_evento_links` (`dados_etapa1`, `dados_etapa2`) e não são contados nessa verificação.

Resultado: mesmo com o associado tendo enviado fotos e B.O. pelo link, o checklist mostra "Documentos anexados" como cinza (não concluído).

## Solução

Alterar a condição do checklist para considerar também os documentos extraídos do link do evento. A função `extrairDocumentosDoLink` já existe no arquivo e faz exatamente essa extração.

## Alteração

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

Na linha 1787, mudar a condição de:

```typescript
documentos.length > 0 ? "bg-green-500" : "bg-muted"
```

Para:

```typescript
(documentos.length > 0 || extrairDocumentosDoLink(linkEvento).length > 0) ? "bg-green-500" : "bg-muted"
```

Isso faz o checklist considerar como "concluído" quando existirem documentos em qualquer uma das fontes: tabela `sinistro_documentos` OU dados do link do evento.

Alteração mínima, uma única linha, sem impacto em nenhum outro comportamento.
