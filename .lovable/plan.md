# Correção do OCR no envio público de documentos

## Diagnóstico

O OCR (`document-ocr`) ESTÁ extraindo os dados corretamente, mas a **UI de edição usa nomes de chaves diferentes** dos que o OCR retorna. Resultado: os campos aparecem em branco mesmo quando o documento foi lido com sucesso (ex.: 80% e 68% de confiança nos prints).

### Campos quebrados identificados

**CRLV — campo "Ano" vazio**
- OCR retorna: `ano_fabricacao` e `ano_modelo` (dois inteiros separados)
- UI espera: `ano` (uma string única)
- Arquivo: `src/components/ocr/ocr-fields-schema.ts` linha 82

**Comprovante de Residência — "Nome do titular", "CPF" e "Bairro" vazios**
- OCR retorna: `nome_titular` (e o "Bairro" é extraído como `bairro`, mas em comprovantes onde o bairro está embutido no logradouro, fica null)
- UI espera: `nome` e `cpf`
- O prompt do OCR para comprovante **nem pede CPF** (só nome_titular, endereço, tipo, data)
- Arquivo: `src/components/ocr/ocr-fields-schema.ts` linhas 97-107

## O que será feito

### 1. Alinhar schema da UI às chaves reais do OCR
Em `src/components/ocr/ocr-fields-schema.ts`:
- **CRLV**: trocar `{ key: 'ano' }` por `{ key: 'ano_fabricacao', label: 'Ano fab.' }` + `{ key: 'ano_modelo', label: 'Ano mod.' }`.
- **Comprovante de residência**: trocar `{ key: 'nome' }` por `{ key: 'nome_titular', label: 'Nome do titular' }`.

### 2. Adicionar extração de CPF no comprovante de residência
Em `supabase/functions/document-ocr/index.ts` (seção "### Comprovante de Residência", ~linha 356):
- Incluir `cpf_titular` (XXX.XXX.XXX-XX) na lista de campos quando visível no documento (comum em IPTU, faturas de cartão, declarações).
- Manter como opcional (null se não estiver presente — não bloqueia aprovação).
- Adicionar `cpf_titular` à lista `dadosFields` do fallback regex (linha 464).
- Schema da UI passa a ler `cpf_titular` em vez de `cpf` para esse tipo.

### 3. Reforçar extração de bairro no prompt
No mesmo prompt do comprovante:
- Instrução explícita: "Quando o bairro vier embutido no logradouro (ex.: 'EST CAFUNDA - TAQUARA'), separe e preencha `bairro` com a parte após o hífen/vírgula."
- Quando o documento (ex.: conta de luz) não imprime bairro, deixar null e sugerir REVISAR (não reprovar).

### 4. Compatibilidade retroativa
Documentos já processados continuam funcionando — só as chaves novas passam a ter rótulo correto. Edição manual já existente do usuário não é perdida (o merge em `UnifiedDocumentUploader` mantém o que foi editado).

## Arquivos alterados

- `src/components/ocr/ocr-fields-schema.ts` — corrigir keys de CRLV e comprovante de residência
- `supabase/functions/document-ocr/index.ts` — adicionar `cpf_titular` e regra de bairro embutido
- Deploy da edge function `document-ocr`

## Validação

Após o deploy, reenviar os mesmos documentos do print:
- CRLV LTB4J74 → "Ano fab." e "Ano mod." preenchidos (2013/2014 ou similar)
- Comprovante de residência → "Nome do titular", "CPF" (se visível) e "Bairro" preenchidos
