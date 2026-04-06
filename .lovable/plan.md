
# Plano: corrigir o 400 ao salvar CNH/CRLV em `contratos_documentos`

## Diagnóstico
- O problema não está no upload nem no OCR: eles funcionam. A evidência é que, no mesmo fluxo, o comprovante de residência salva e CNH/CRLV falham.
- Em `src/components/contratos/UnifiedDocumentUploader.tsx`, o INSERT envia:
  - `status: ocrResult.sugestao === 'aprovar' ? 'em_analise' : 'pendente'`
  - `tipo: ocrResult.tipo_detectado`
- Mas a tabela `contratos_documentos` ainda aceita apenas:
  - `status IN ('pendente', 'processando', 'aprovado', 'reprovado')`
  - `tipo IN ('crlv', 'cnh', 'rg', 'comprovante_residencia', 'laudo_vistoria')`
- Resultado:
  - CNH/CRLV com OCR “aprovar” tentam inserir `status = 'em_analise'` e recebem 400
  - `nota_fiscal_veiculo` também falhará quando for detectado
- As políticas RLS de `anon` e `authenticated` já existem; o padrão indica erro de constraint/payload, não falta de permissão.

## Implementação
### 1. Alinhar o uploader ao schema válido
- Em `UnifiedDocumentUploader.tsx`, parar de gravar `em_analise` no INSERT.
- Salvar o documento com `status: 'pendente'` (ou `processando` + update posterior), seguindo o padrão já usado em `src/hooks/useContratoDocumentos.ts`.

### 2. Corrigir suporte à Nota Fiscal do Veículo
- Criar migration para atualizar `contratos_documentos_tipo_check` e incluir `nota_fiscal_veiculo`.
- Isso mantém a distinção entre CRLV e Nota Fiscal sem quebrar o fluxo público.

### 3. Harmonizar tipos da interface de análise
- Atualizar `src/types/documentos.ts` e pontos de consumo para aceitar `nota_fiscal_veiculo`.
- Garantir label correta na tela de documentos aprovados/análise.

### 4. Melhorar diagnóstico de erro
- No uploader, registrar `code`, `message`, `details` e `hint` do Supabase no console.
- Exibir mensagem mais específica quando a falha vier de constraint, para facilitar suporte futuro.

### 5. Preservar a recuperação dos arquivos já enviados
- Manter o estado de erro na UI quando o INSERT falhar.
- Adicionar caminho de reprocessamento/reenvio sem exigir novo upload físico, quando possível.

## Arquivos envolvidos
- `src/components/contratos/UnifiedDocumentUploader.tsx`
- `src/hooks/useContratoDocumentos.ts` (referência do padrão correto)
- `src/types/documentos.ts`
- `supabase/migrations/...` nova migration para `contratos_documentos_tipo_check`

## Detalhes técnicos
```text
Hoje:
OCR aprovar -> status em_analise -> CHECK falha -> 400

Após ajuste:
OCR conclui -> INSERT com pendente/processando -> salva
OCR detecta nota_fiscal_veiculo -> tipo aceito pelo banco
```

- Não vou mexer em RLS como solução principal, porque o sintoma atual é compatível com constraint inválida no payload.
- O fato de um documento salvar e outros não, no mesmo envio, reforça que a falha é de valor enviado (`status`/`tipo`), não de autenticação.
