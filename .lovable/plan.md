

## Diagnóstico: Erro 500 no OCR de Documentos na Cotação Pública

### Problema Identificado

O screenshot mostra:
- **Erro:** `Failed to load resource: the iyxdgmukrrdkffraptsx...s/v1/document-ocr - status 500`
- **Mensagem:** `Edge Function returned a non-2xx status code`
- Acontece ao ler o **CRLV** (documento do veículo) após upload

### Causa Raiz

Analisando o fluxo, identifiquei **dois cenários** onde o erro pode ocorrer:

#### 1. Fluxo `CotacaoPublicaCompleta.tsx` - NÃO converte PDF antes do OCR (linha 295-319)

Quando o upload é feito via `useUploadDocumento` (hook simplificado), o arquivo é enviado diretamente ao storage e depois a URL é passada para o OCR. Se o arquivo for **PDF**, a Edge Function `document-ocr` recebe a URL do PDF (não uma imagem) e pode falhar ao tentar processá-lo.

**Código atual (problemático):**
```typescript
// Linha 295-299 - chama OCR diretamente com URL do PDF
if (doc.tipo === 'crlv' && result.url && token) {
  const { data: ocrData } = await supabase.functions.invoke('document-ocr', {
    body: { url: result.url }  // ❌ URL pode ser de PDF!
  });
}
```

#### 2. O hook `useUploadDocumento` em `useCotacaoPublica.ts` (linha 140-158) NÃO converte PDFs

```typescript
// Apenas faz upload, sem conversão de PDF
const { error: uploadError } = await supabase.storage
  .from('cotacoes-docs')
  .upload(path, file, { upsert: true });  // ❌ Envia PDF como está
```

**Enquanto isso**, o `UnifiedDocumentUploader.tsx` (usado nos contratos) **FAZ a conversão** corretamente (linhas 117-137):
```typescript
// Converte PDF para imagem antes do upload
if (isPdf(file)) {
  toast.info('Convertendo PDF para imagem...');
  const imageBlob = await convertPdfToImage(file);
  fileToUpload = new File([imageBlob], finalFileName, { type: 'image/jpeg' });
}
```

### Solução

Adicionar a conversão de PDF para imagem no hook `useUploadDocumento` da cotação pública, similar ao que já existe no `UnifiedDocumentUploader`.

---

## Alterações Necessárias

### Arquivo: `src/hooks/useCotacaoPublica.ts`

**Adicionar importação:**
```typescript
import { isPdf, convertPdfToImage, getPdfConvertedName } from '@/lib/pdfToImage';
```

**Atualizar `useUploadDocumento` para converter PDFs:**
```typescript
export function useUploadDocumento() {
  return useMutation({
    mutationFn: async ({ cotacaoId, tipo, file }: UploadDocumentoParams) => {
      let fileToUpload = file;
      let fileName = file.name;
      
      // Converter PDF para imagem antes do upload
      if (isPdf(file)) {
        try {
          const imageBlob = await convertPdfToImage(file);
          fileName = getPdfConvertedName(file.name);
          fileToUpload = new File([imageBlob], fileName, { type: 'image/jpeg' });
        } catch (pdfError) {
          console.error('Erro ao converter PDF:', pdfError);
          throw new Error('Erro ao converter PDF. Tente enviar como imagem JPG ou PNG.');
        }
      }
      
      const ext = fileName.split('.').pop() || 'jpg';
      const path = `cotacoes/${cotacaoId}/${tipo}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('cotacoes-docs')
        .upload(path, fileToUpload, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cotacoes-docs')
        .getPublicUrl(path);

      return { url: publicUrl, tipo };
    },
  });
}
```

### Arquivo: `src/hooks/useCotacaoPublica.ts` - também atualizar `useUploadFotoVistoria`

Aplicar a mesma lógica de conversão de PDF.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCotacaoPublica.ts` | Adicionar conversão de PDF para imagem nos hooks `useUploadDocumento` e `useUploadFotoVistoria` |

---

## Comportamento Esperado Após Correção

**Antes (com erro):**
1. Cliente faz upload de CRLV em PDF
2. PDF é enviado ao storage como está
3. OCR recebe URL do PDF e falha (erro 500)

**Depois (corrigido):**
1. Cliente faz upload de CRLV em PDF
2. **Sistema converte PDF para JPG no browser**
3. JPG é enviado ao storage
4. OCR recebe URL da imagem e processa normalmente

---

## Impacto

- ✅ Corrige erro 500 ao processar documentos PDF
- ✅ Mantém compatibilidade com imagens (JPG/PNG) que já funcionam
- ✅ Usa a mesma lógica já validada no `UnifiedDocumentUploader`
- ✅ Não requer alteração na Edge Function

---

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Atualizar `useUploadDocumento` | 2 min |
| Atualizar `useUploadFotoVistoria` | 1 min |
| Testar com PDF real | 3 min |
| **Total** | **~6 min** |

