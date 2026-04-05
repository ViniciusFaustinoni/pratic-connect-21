

# Corrigir Documentos Chegando como "Aprovado" em vez de "Em Análise"

## Problema
Em `src/components/contratos/UnifiedDocumentUploader.tsx` (linha 206), quando o OCR/IA sugere aprovação (`ocrResult.sugestao === 'aprovar'`), o documento é inserido com `status: 'aprovado'` diretamente. Isso pula a etapa de análise manual pelo analista de cadastro.

O analista deveria receber todos os documentos como "em_analise" para poder revisar e aprovar individualmente.

## Solução

### `src/components/contratos/UnifiedDocumentUploader.tsx`

Alterar a linha 206 para usar `'em_analise'` quando o OCR sugere aprovação, em vez de `'aprovado'`:

```typescript
// Antes:
status: ocrResult.sugestao === 'aprovar' ? 'aprovado' : 'pendente',

// Depois:
status: ocrResult.sugestao === 'aprovar' ? 'em_analise' : 'pendente',
```

Dessa forma:
- Documentos que passam na validação OCR chegam como **"Em Análise"** (prontos para o analista revisar)
- Documentos que falham na validação OCR continuam como **"Pendente"**
- O analista mantém o poder de aprovar/reprovar cada documento individualmente

## Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/components/contratos/UnifiedDocumentUploader.tsx` | Alterar status de `'aprovado'` para `'em_analise'` (1 linha) |

