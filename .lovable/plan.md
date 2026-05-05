## Problema

Hoje, na autovistoria e nos uploads da cotação pública, quando o OCR não consegue ler um documento/foto, o sistema **falha silenciosamente** ou **só pede o chassi manual**. O associado não é avisado e não tem como preencher os dados que o OCR perdeu (KM do odômetro, cor/blindado do CRLV, dados da CNH, etc.). Isso trava ou degrada a vistoria sem dar saída ao usuário.

Pontos confirmados na auditoria do código:

- `src/hooks/useContratoLink.ts` (`useUploadFotoAutovistoria`): chama `odometro-ocr`; se falhar ou confiança < 0.7, **não avisa** e não pede KM manual.
- `src/components/associado/Autovistoria.tsx` e `src/components/cotacao-publica/AutovistoriaCotacao.tsx`: só exibem KM quando OCR teve sucesso. Sem fallback.
- `src/pages/public/CotacaoPublicaCompleta.tsx` (upload CRLV): se OCR falhar, apenas faz `console.warn` e segue sem cor/blindado.
- `src/components/cotacao-publica/DocumentosPendentesPublico.tsx` já usa `OcrDadosEditor` (suporta `forceEdit`/`legivel=false`) — bom como referência, mas não é aplicado no fluxo da cotação pública nova nem na autovistoria.

Já existe componente reusável: `src/components/ocr/OcrDadosEditor.tsx` (renderiza os campos do schema, abre automaticamente em modo edição quando `legivel=false` ou `sugestao='reprovar'`). Vamos reaproveitar.

## O que vai mudar

### 1. Autovistoria — fallback de KM (odômetro)
**Arquivos:** `src/hooks/useContratoLink.ts`, `src/components/associado/Autovistoria.tsx`, `src/components/cotacao-publica/AutovistoriaCotacao.tsx`

- `useUploadFotoAutovistoria` passa a retornar `ocrFalhou: boolean` (true quando `odometro-ocr` errou, retornou confiança < 0.7 ou KM nulo).
- Quando `fotoAtual.id === 'odometro'` e `ocrFalhou`, o componente mostra:
  - Toast de aviso: *"Não conseguimos ler o odômetro. Informe a quilometragem manualmente."*
  - Card com `Input` numérico para KM (`Quilometragem atual`) + botão **Salvar KM**.
- Ao salvar manualmente:
  - Persiste `km_extraido` em `vistoria_fotos` (nova coluna `dados_manuais jsonb` se necessário, ou usa coluna existente — verificar via migration).
  - Avança para próxima foto normalmente.
- Mesmo comportamento espelhado em `Autovistoria.tsx` (associado logado) e `AutovistoriaCotacao.tsx` (cotação pública).

### 2. Cotação pública — fallback de CRLV/CNH/comprovante
**Arquivo:** `src/pages/public/CotacaoPublicaCompleta.tsx`

- Após o upload de **qualquer** documento (CNH, CRLV, comprovante) chamar `document-ocr` e:
  - Se `ocrData?.sucesso === false`, `legivel === false`, ou `sugestao === 'reprovar'`/`'revisar'`, **abrir um modal** com `<OcrDadosEditor forceEdit dados={ocrData?.dados} tipoDocumento={doc.tipo} legivel={false} onSave={...} />`.
  - Toast: *"Não conseguimos ler {doc.nome}. Por favor, confirme/preencha os dados manualmente."*
- O `onSave` salva os campos no destino correto (cotação pública: `veiculo_cor`, `veiculo_blindado`, etc; CNH: dados do lead; comprovante: endereço).
- Hoje só CRLV é processado — **estender** para `cnh_frente`, `cnh_verso`, `comprovante` usando o mesmo padrão (chamada `document-ocr` + fallback editor).

### 3. Generalização visual e mensagens
**Arquivo:** novo helper `src/components/ocr/OcrFallbackBanner.tsx`

- Banner padrão amarelo/âmbar com ícone `AlertTriangle`:
  *"Não foi possível ler automaticamente o(s) dados de {tipoDocumento}. Preencha manualmente abaixo."*
- Usado em todos os pontos acima para garantir UX consistente.

### 4. Regras de negócio respeitadas
- **Chassi continua sempre manual** (memory `chassi-sempre-manual`). Nada muda nessa parte.
- O OCR continua sendo **best-effort**: nunca bloqueia o fluxo. A diferença é que agora, ao falhar, **abre o editor manual** em vez de silenciar.
- Documentos aprovados pelo OCR continuam indo para `em_analise` (memory `aprovacao-manual-documentos-vistoria`); o preenchimento manual também entra como `em_analise`.

## Resumo técnico

```text
upload foto/doc
   │
   ▼
chama edge OCR (document-ocr | odometro-ocr)
   │
   ├── sucesso + confiança ok ──► segue fluxo (KM exibido / dados gravados)
   │
   └── falha / confiança baixa / legivel=false
         │
         ▼
   OcrFallbackBanner + OcrDadosEditor(forceEdit)
         │
         ▼
   onSave grava dados manuais no mesmo destino (cotacao_publica / vistoria_fotos)
```

Sem alteração de schema obrigatória — usaremos colunas já existentes (`km_extraido`, `veiculo_cor`, `veiculo_blindado`, `lead.endereco_*`, etc.). Caso falte coluna para algum dado avulso, criaremos uma migration pequena para `vistoria_fotos.dados_manuais jsonb`.
