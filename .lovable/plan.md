
# Corrigir erro de versao do PDF.js Worker

## Problema

O erro ocorre porque a versao do pacote `pdfjs-dist` instalado foi atualizada automaticamente para **4.10.38** (devido ao `^4.4.168` no package.json), mas o Worker do PDF.js esta com a URL do CDN fixada na versao **4.4.168**:

```
Error: The API version "4.10.38" does not match the Worker version "4.4.168"
```

## Solucao

Atualizar o arquivo `src/lib/pdfToImage.ts` para usar a versao do worker de forma dinamica, extraindo a versao diretamente do pacote instalado.

## Detalhe tecnico

### Arquivo: `src/lib/pdfToImage.ts`

Alterar a linha 4 de:
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
```

Para:
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```

Isso garante que a versao do Worker sempre corresponda a versao da API, independente de atualizacoes futuras do pacote.

## Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/lib/pdfToImage.ts` | Usar `pdfjsLib.version` na URL do CDN worker |
