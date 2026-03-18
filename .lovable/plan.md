

## Plano: Aceitar Nota Fiscal como alternativa ao CRLV no link público

### Problema
Atualmente, o fluxo público de documentos (contratação via link) exige CRLV obrigatoriamente. Veículos zero km ou recém-comprados podem não ter CRLV ainda, tendo apenas a Nota Fiscal de compra.

### O que será feito

**1. OCR Edge Function (`supabase/functions/document-ocr/index.ts`)**
- Adicionar `nota_fiscal_veiculo` como novo tipo detectável no prompt do sistema
- Campos a extrair: `valor_nota_fiscal`, `chassi` (17 chars), `numero_motor`, `placa` (se presente), `marca`, `modelo`, `ano_fabricacao`, `ano_modelo`, `cor`, `nome_comprador`
- A IA deve detectar automaticamente quando o documento é uma NF de veículo (DANFE/NF-e com dados veiculares)

**2. UnifiedDocumentUploader (`src/components/contratos/UnifiedDocumentUploader.tsx`)**
- Adicionar `nota_fiscal_veiculo` ao tipo `TipoDocumentoDetectado`
- Adicionar label e ícone para o novo tipo
- Atualizar `documentosEsperados` para indicar que CRLV aceita NF como alternativa

**3. EtapaDadosPessoaisDocumentos (`src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`)**
- Aceitar `nota_fiscal_veiculo` como substituto do CRLV na checklist
- `temCrlv` passa a ser `true` quando detectado `crlv` OU `nota_fiscal_veiculo`
- No handler de OCR, mapear dados da NF (chassi, motor, valor) para os campos de `DadosExtraidos`
- Adicionar `valor_nota_fiscal` ao `DadosExtraidos` e ao formulário de dados
- Atualizar label do checklist de "CRLV do Veículo" para "CRLV ou Nota Fiscal do Veículo"
- Exibir badge "Extraído da Nota Fiscal" quando for NF

**4. DocumentosPendentesPublico (`src/components/cotacao-publica/DocumentosPendentesPublico.tsx`)**
- Adicionar `nota_fiscal_veiculo` ao `TIPO_DOCUMENTO_LABELS`

**5. FormularioDadosPessoais types**
- Adicionar campo `valor_nota_fiscal` ao `DadosPessoaisForm` se necessário para persistência

### Arquivos alterados
1. `supabase/functions/document-ocr/index.ts` — novo tipo no prompt de IA
2. `src/components/contratos/UnifiedDocumentUploader.tsx` — tipo, label, ícone
3. `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` — checklist, OCR handler, dados extraídos
4. `src/components/cotacao-publica/DocumentosPendentesPublico.tsx` — label do tipo

