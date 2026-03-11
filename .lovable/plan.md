

# Otimização: Eliminar conversão PDF→Imagem e enviar PDF direto para IA

## Diagnóstico

O sistema tem um fluxo desnecessariamente lento para documentos PDF:

```text
FLUXO ATUAL (lento):
  Cliente recebe PDF
    → pdf.js renderiza no canvas (pesado, ~3-5s)
    → Exporta como JPEG (~1-2s)
    → Upload do JPEG para storage
    → Edge function envia URL da imagem para Gemini 2.5 Pro (modelo mais lento/caro)
    → Gemini analisa imagem

FLUXO PROPOSTO (rápido):
  Cliente recebe PDF
    → Upload direto do PDF para storage (sem conversão)
    → Edge function baixa PDF, converte para base64
    → Envia como data:application/pdf;base64,... para Gemini 2.5 Flash (3-5x mais rápido)
```

**O `extract-orcamento-pdf` já funciona assim!** Ele já envia PDF direto como base64 com `data:application/pdf;base64,...` e usa `gemini-2.5-flash`. A solução é replicar esse padrão no `document-ocr`.

### Pontos de conversão PDF→Imagem no código (3 locais):
1. `src/hooks/useCotacaoPublica.ts` — `useUploadDocumento` e `useUploadFotoVistoria`
2. `src/components/contratos/UnifiedDocumentUploader.tsx`

### Modelo usado:
- `document-ocr`: **gemini-2.5-pro** (mais lento, ~2x mais caro)
- `extract-orcamento-pdf`: gemini-2.5-flash (já otimizado)
- `odometro-ocr`: gemini-2.5-flash-image (já otimizado)

## Plano de implementação

### 1. Remover conversão PDF→Imagem nos 3 locais do frontend
- `useCotacaoPublica.ts`: remover blocos `isPdf()` em `useUploadDocumento` e `useUploadFotoVistoria` — upload PDF direto
- `UnifiedDocumentUploader.tsx`: remover bloco `isPdf()` — upload PDF direto
- Manter o `contentType` correto (`application/pdf`) para PDFs

### 2. Atualizar edge function `document-ocr`
- Detectar se a URL termina em `.pdf`
- Se PDF: baixar arquivo, converter para base64, enviar como `data:application/pdf;base64,...` (mesmo padrão do `extract-orcamento-pdf`)
- Se imagem: manter fluxo atual com URL direta
- Trocar modelo de `gemini-2.5-pro` para `gemini-2.5-flash` (3-5x mais rápido, qualidade suficiente para OCR de documentos brasileiros)
- Manter `gemini-2.5-pro` apenas no retry de CPF (caso raro)

### 3. Limpeza
- `src/lib/pdfToImage.ts` pode ser removido se nenhum outro arquivo o usar após as mudanças

## Impacto esperado
- **Eliminação de ~5-8 segundos** de conversão PDF→canvas→JPEG no cliente
- **Redução de ~50-60%** no tempo de resposta da IA (flash vs pro)
- **Menor consumo de créditos** (flash é mais barato que pro)
- **Melhor qualidade**: PDF nativo preserva texto digital; a conversão para JPEG degrada qualidade

## Arquivos a modificar
- `supabase/functions/document-ocr/index.ts` — detectar PDF, baixar+base64, trocar modelo
- `src/hooks/useCotacaoPublica.ts` — remover conversão PDF→imagem
- `src/components/contratos/UnifiedDocumentUploader.tsx` — remover conversão PDF→imagem

## Arquivo a deletar
- `src/lib/pdfToImage.ts` (após confirmar que não há outros imports)

