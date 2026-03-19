

# Fix PDF Preview in Document Approval Modal

## Problem

The `VisualizadorDocumentoModal` uses an `<iframe>` to display PDFs (line 172), but this fails silently — the PDF appears blank (as shown in the screenshot). This is likely due to Supabase Storage response headers (`X-Frame-Options` or `Content-Disposition: attachment`) preventing iframe embedding.

## Solution

Replace the `<iframe>` with an `<object>` tag (better PDF embedding support) combined with a Google Docs Viewer fallback. If neither works, show a clear fallback with an "Open in new tab" button.

### Changes in `src/components/cadastro/VisualizadorDocumentoModal.tsx`

Replace the PDF section (lines 171-176):

```tsx
{isPdf ? (
  <object
    data={documento.arquivo_url}
    type="application/pdf"
    className="w-full h-[500px] rounded-lg"
  >
    {/* Fallback: Google Docs Viewer for public URLs */}
    <iframe
      src={`https://docs.google.com/gview?url=${encodeURIComponent(documento.arquivo_url)}&embedded=true`}
      className="w-full h-[500px] rounded-lg"
      title={tipoLabels[documento.tipo] || 'Documento'}
    />
  </object>
)
```

### Also fix `src/components/cadastro/DocumentViewDialog.tsx`

Same issue on line 63-67 — replace the `<iframe>` with the same `<object>` + fallback pattern.

| File | Change |
|------|--------|
| `src/components/cadastro/VisualizadorDocumentoModal.tsx` | Replace `<iframe>` with `<object>` + Google Docs fallback |
| `src/components/cadastro/DocumentViewDialog.tsx` | Same fix |

