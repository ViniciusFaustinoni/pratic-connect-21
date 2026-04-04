

# Dados da CNH não exibidos na aba Dados Pessoais

## Diagnóstico

Os campos `cnh_numero` e `cnh_categoria` estão **NULL** no banco de dados para este associado. Apenas `cnh_validade` tem valor (2033-01-18).

O OCR **extrai** corretamente os dados da CNH (`numero_registro`, `categoria`, `validade`), mas essa extração só é gravada na tabela `associados` quando o documento é enviado pelo fluxo de **contratação** (`useCotacaoContratacao.ts`). Documentos enviados por outros caminhos (upload direto, fila de documentos) **não atualizam** os campos de CNH do associado.

## Solução

Criar um mecanismo que, ao processar OCR de uma CNH (em qualquer fluxo), atualize automaticamente os campos `cnh_numero`, `cnh_categoria` e `cnh_validade` na tabela `associados`.

### 1. Alterar `src/hooks/useContratoDocumentos.ts`

Após o OCR retornar com sucesso para um documento tipo `cnh`, buscar o `associado_id` do contrato e atualizar os campos CNH no registro do associado:

```text
Se tipo === 'cnh' && ocrResult.sucesso && ocrResult.dados:
  → buscar associado_id pelo contrato_id
  → update associados SET cnh_numero, cnh_categoria, cnh_validade
    WHERE id = associado_id
    (só atualizar campos que vieram do OCR e que estejam NULL no associado)
```

### 2. Alterar `src/hooks/useUploadDocumento.ts` (upload direto)

Mesmo tratamento: após OCR de CNH com sucesso, gravar os dados extraídos no associado.

### 3. Alterar a edge function `document-ocr` (opcional mas recomendado)

Garantir que o campo `categoria` seja retornado no objeto `dados` da resposta (já está no prompt, verificar se chega no resultado).

## Dados existentes

Para o associado Marcus Vinicius que já tem documentos processados, verificar se há `ocr_resultado` com dados da CNH salvos nos documentos — se sim, rodar um script de correção para preencher os campos `cnh_numero` e `cnh_categoria` a partir dos dados já extraídos.

## Impacto
- 2 arquivos alterados (`useContratoDocumentos.ts`, `useUploadDocumento.ts`)
- 0 migrations
- Dados existentes podem ser corrigidos via script pontual

