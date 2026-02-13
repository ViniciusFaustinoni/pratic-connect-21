
# Corrigir erro de versao do PDF.js Worker

## Problema

O CDN do cdnjs nao possui o arquivo worker para a versao `4.10.38` do pdfjs-dist. Mesmo usando `pdfjsLib.version` na URL, o arquivo simplesmente nao existe no CDN, gerando o mesmo erro.

## Solucao

Usar o import com sufixo `?url` do Vite, que resolve o caminho do worker localmente a partir do `node_modules`. Isso elimina completamente a dependencia do CDN.

## Detalhe tecnico

### Arquivo: `src/lib/pdfToImage.ts`

Alterar as linhas 1-4 de:
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker from CDN (avoids need to copy worker file)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
```

Para:
```typescript
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker using Vite's ?url import (local, no CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
```

Isso faz o Vite copiar o arquivo worker para o build output com o caminho correto, eliminando problemas de versao e CORS.

## Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/lib/pdfToImage.ts` | Substituir URL do CDN por import local com `?url` |
