

## Aceitar "Declaração de Residência" como comprovante válido

### Diagnóstico

Hoje o OCR (`supabase/functions/document-ocr/index.ts`, linhas 333-336) aceita como comprovante de residência apenas: contas (água/luz/gás/telefone/internet), faturas/boletos, IPTU/IPVA, IRPF, extratos, contratos de aluguel e escrituras. O enum `tipo_comprovante` lista 12 valores, **nenhum cobre "declaração de residência"** (documento auto-declarado, geralmente assinado pelo próprio associado ou por um terceiro residente do mesmo endereço).

Resultado: quando o associado envia uma declaração como a do exemplo (modelo livre com CPF, endereço completo e assinatura), o modelo classifica como `outro` ou reprova por não identificar tipo conhecido — e o associado é forçado a buscar uma conta em seu nome, o que muitas vezes não tem (mora com familiares, aluguel informal, etc.).

### O que vai mudar

**1. Adicionar `declaracao_residencia` ao enum de tipos aceitos** (`document-ocr/index.ts`, linha 335)

Incluir `"declaracao_residencia"` na lista de valores válidos do campo `tipo_comprovante`.

**2. Atualizar o bloco de instruções do Comprovante de Residência** (linhas 333-342)

Adicionar regra explícita:

> **Declaração de Residência** (modelo livre, escrito pelo próprio interessado ou por terceiro):
> - Aceitar quando contiver: título "DECLARAÇÃO DE RESIDÊNCIA" (ou variante), nome e CPF do declarante, endereço completo (CEP + logradouro + número + bairro + cidade + UF), local/data e assinatura.
> - Extrair os campos de endereço normalmente nos campos padrão.
> - `tipo_comprovante = "declaracao_residencia"`.
> - `nome_titular` = nome do declarante.
> - **Titularidade**: se o declarante = nomeEsperado → aprovar. Se for terceiro (nome diferente) com mesmo endereço, sugerir **REVISAR** (analista valida vínculo familiar/residente do mesmo lar). Se faltar assinatura ou CPF, sugerir REVISAR. Se faltar endereço completo, REPROVAR.
> - Aceitar sem reconhecimento de firma (validação humana cobre o resto).

**3. Mapear o novo tipo no front-end onde aparecem labels/ícones**

Apenas para exibição amigável quando o analista revisar o documento. Os arquivos abaixo já listam `tipo_comprovante` indiretamente via OCR (não é enum do banco), então o ajuste é só de label nos pontos onde mostramos a origem do comprovante:

- `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` — já trata `comprovante_residencia` genericamente; nenhum mapeamento extra necessário (o tipo continua sendo `comprovante_residencia`, só muda o `tipo_comprovante` interno).
- Adicionar uma linha de ajuda no UI de upload (`UnifiedDocumentUploader.tsx`) explicando que **"Declaração de residência (modelo livre, com CPF e assinatura) também é aceita"** abaixo do label "Comprovante de Residência" — reduz dúvidas e re-uploads.

**4. Política de aprovação manual**

Conforme regra existente em `mem://logic/operations/aprovacao-manual-documentos-vistoria`, mesmo declarações com sugestão "aprovar" do OCR continuam entrando como `em_analise` para revisão humana — comportamento já garantido pelo pipeline atual, sem mudança.

### O que NÃO muda

- `tipo_documento` permanece `comprovante_residencia` (não criamos enum novo no banco).
- Campos extraídos (logradouro, número, CEP, etc.) continuam alimentando o auto-preenchimento de endereço.
- Validação de titularidade segue idêntica para os demais tipos.
- Bucket, RLS, fluxo de upload e revisão pelo analista permanecem intactos.

### Arquivos editados

- `supabase/functions/document-ocr/index.ts` — adicionar `declaracao_residencia` ao enum `tipo_comprovante` e bloco de regras (linhas 333-342).
- `src/components/contratos/UnifiedDocumentUploader.tsx` — texto auxiliar no card do Comprovante de Residência indicando que declaração de residência é aceita.

### Riscos

- Declarações falsas: como é documento auto-declarado, o risco de fraude é maior que conta de luz. Mitigado por: (a) aprovação manual obrigatória; (b) sugestão de REVISAR sempre que titular ≠ associado; (c) o endereço extraído é cruzado com a vistoria (foto da fachada) na etapa de instalação.
- Modelos manuscritos/ilegíveis: o OCR pode falhar; nesse caso retorna `legivel:false` e o analista trata normalmente.

