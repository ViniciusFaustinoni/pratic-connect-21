
# Corrigir Upload de Arquivos .jfif na Tela de Documentos

## Problema
Arquivos `.jfif` falham no upload com "Erro ao enviar arquivo para o storage", apesar da policy RLS ja incluir a extensao `.jfif`. O problema esta no content-type: navegadores frequentemente reportam `.jfif` como `image/jpeg` ou ate `application/octet-stream`, e o Supabase Storage pode nao inferir corretamente o MIME type para extensoes incomuns.

## Causa Raiz
No `UnifiedDocumentUploader.tsx` (linha 151-156), o upload nao especifica `contentType` explicitamente. O Supabase tenta inferir do File object, mas para extensoes como `.jfif`, `.heic`, `.bmp`, o browser pode nao fornecer um MIME type correto, causando falha silenciosa no storage.

## Solucao

### Arquivo: `src/components/contratos/UnifiedDocumentUploader.tsx`

**Mudanca 1 - Adicionar mapeamento de MIME types** (apos as constantes existentes, ~linha 68):
```typescript
const MIME_TYPE_MAP: Record<string, string> = {
  'jfif': 'image/jpeg',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'gif': 'image/gif',
  'heic': 'image/heic',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'pdf': 'application/pdf',
};
```

**Mudanca 2 - Definir contentType explicito no upload** (linhas 147-156):
Apos obter `sanitizedFileName`, extrair a extensao e usar o mapeamento para definir o `contentType` no call de upload:
```typescript
const fileExt = sanitizedFileName.split('.').pop()?.toLowerCase() || '';
const contentType = MIME_TYPE_MAP[fileExt] || file.type || 'application/octet-stream';

const { data: uploadData, error: uploadError } = await supabaseClient.storage
  .from(bucketName)
  .upload(filePath, fileToUpload, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });
```

**Mudanca 3 - Log detalhado do erro** (linhas 158-161):
Melhorar o log de erro para incluir detalhes que facilitem debug futuro:
```typescript
if (uploadError) {
  console.error('Upload error:', uploadError, {
    fileName: sanitizedFileName,
    contentType,
    fileSize: fileToUpload.size,
    bucket: bucketName,
  });
  throw new Error('Erro ao enviar arquivo para o storage.');
}
```

## Impacto
- Arquivos `.jfif`, `.heic`, `.bmp`, `.gif`, `.tiff` passarao a ser enviados com o content-type correto
- Nenhuma mudanca funcional para formatos que ja funcionam (JPG, PNG, PDF)
- Log de erro mais informativo para debug futuro
