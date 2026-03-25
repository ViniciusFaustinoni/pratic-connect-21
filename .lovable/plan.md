

# Formatação Inteligente de PDFs e Botão IA para Variáveis

## Problema
1. PDFs gerados (propostas, termos aditivos, contratos Autentique) deixam **páginas em branco** no final devido a cálculos imprecisos de paginação
2. Ao criar/editar termos aditivos e templates, o usuário precisa inserir variáveis manualmente -- falta um **botão de IA** que analise o texto e sugira/insira as variáveis automaticamente

## Solução

### Parte 1 -- Eliminar páginas em branco nos PDFs

**1a. `gerarTermoPDF.ts` (PDF de termos via html2canvas)**
- O loop `while (heightLeft > 0)` cria páginas mesmo quando o conteúdo restante é mínimo (< 5mm). Adicionar threshold: se `heightLeft < 10`, não criar nova página
- Após gerar todas as páginas, verificar se a última página está efetivamente em branco e removê-la (`pdf.deletePage`)

**1b. `useGerarProposta.ts` (Proposta via pdf-lib)**
- O loop de renderização de anexos (linhas 443-492) não rastreia corretamente as novas páginas criadas. O `annexPage` original pode ficar vazio se todo o conteúdo migrar para `newPage`. Adicionar lógica de detecção de página vazia e remoção
- Após `pdfDoc.save()`, usar `PDFDocument.load()` para percorrer páginas e remover as que não têm conteúdo visível (sem text operators)

**1c. `template-utils.ts` (CSS dos contratos Autentique/HTML)**
- Aditivos usam `page-break-after: always` na última div, gerando uma página final em branco. Trocar para `page-break-before: always` apenas a partir do segundo aditivo, sem break após o último
- Ajustar o CSS `.page-break` para usar `page-break-before` em vez de `page-break-after`

**1d. `autentique-create` e `autentique-create-by-token` (Anexos de templates)**
- Mesma lógica: `page-break-before: always` nos anexos em vez de um `<div style="page-break-before: always;"></div>` separado que pode gerar blank page quando o conteúdo anterior já encerra na page boundary

### Parte 2 -- Botão IA "Formatar com Variáveis"

**2a. Nova Edge Function `formatar-texto-ia`**
- Recebe o texto/HTML bruto do editor
- Envia para Lovable AI (Gemini 3 Flash) com um system prompt contendo a lista completa de variáveis disponíveis (extraída de `VariaveisSelector`)
- A IA analisa o texto, identifica onde dados dinâmicos devem ser inseridos (nomes, CPFs, datas, valores, etc.) e retorna o HTML com as `{{variáveis}}` corretas nos lugares certos
- Também formata: adiciona headings, parágrafos, listas onde apropriado

**2b. Botão no `EditorToolbar.tsx`**
- Novo botão "✨ Formatar com IA" na toolbar do TipTap
- Ao clicar: pega o conteúdo atual do editor, chama a edge function, e substitui o conteúdo com a versão formatada
- Loading state com spinner enquanto processa
- Confirmação antes de substituir ("A IA formatou o texto e inseriu X variáveis. Aplicar?")

**2c. Integração no `AditivoForm.tsx` e `TemplateForm.tsx`**
- O botão fica disponível automaticamente pois está na toolbar compartilhada
- Nenhuma alteração adicional necessária nos formulários

## Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/gerarTermoPDF.ts` | Threshold de página + remoção de blank pages |
| `src/hooks/useGerarProposta.ts` | Remoção de páginas vazias nos anexos |
| `supabase/functions/_shared/template-utils.ts` | CSS page-break fix + lógica de aditivos |
| `supabase/functions/autentique-create/index.ts` | Fix page-break nos anexos |
| `supabase/functions/autentique-create-by-token/index.ts` | Fix page-break nos anexos |
| `supabase/functions/formatar-texto-ia/index.ts` | Nova edge function para formatação IA |
| `src/components/documentos/tiptap/EditorToolbar.tsx` | Botão "Formatar com IA" |

## Detalhes Técnicos

**System prompt da IA (formatar-texto-ia):**
```
Você é um especialista em documentos jurídicos de proteção veicular.
Receba o texto bruto e retorne HTML formatado com:
1. Estrutura clara (títulos, parágrafos, listas)
2. Variáveis dinâmicas {{grupo.campo}} nos locais corretos
3. Não invente conteúdo, apenas formate e insira variáveis

Variáveis disponíveis: [lista completa dos grupos]
```

**Remoção de blank pages (gerarTermoPDF):**
```typescript
// Antes de retornar o PDF
const pageCount = pdf.getNumberOfPages();
if (pageCount > 1) {
  // Verificar última página - se heightLeft era <= threshold, remover
  // jsPDF não tem deletePage nativo, usar workaround com novo doc
}
```

