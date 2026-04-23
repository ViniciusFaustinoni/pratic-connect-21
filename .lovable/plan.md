

## Edição manual de dados extraídos por OCR (todos os pontos)

### Resumo

Hoje o OCR roda em vários fluxos e grava os dados extraídos sem permitir correção pelo usuário. Vou adicionar **edição manual em todos os pontos onde o OCR é usado** — mantendo o anexo original do documento como está. Quando o OCR falhar, o usuário também terá o **preenchimento manual** disponível como alternativa (nada bloqueia o fluxo).

### Pontos de OCR mapeados (cobertura completa)

| # | Onde | Quem usa | O que é extraído | Estado atual |
|---|---|---|---|---|
| 1 | `CotacaoPublicaCompleta.tsx` (link público) | Associado | CRLV (cor, blindado, chassi, renavam) + outros docs | Sem edição |
| 2 | `DocumentosPendentesPublico.tsx` (link público) | Associado | Tipo + dados gerais | Sem edição |
| 3 | `UnifiedDocumentUploader.tsx` (contrato/cotação interna) | Vendedor / analista | CNH, RG, CRLV, NF, ATPV-e, comprovante | Sem edição (só exibe 3 campos) |
| 4 | `DocumentUploader.tsx` (contrato legado) | Vendedor | CNH/CRLV | Sem edição |
| 5 | `useContratoDocumentos.ts` | Vendedor | CNH (sync para associado) | Sem edição |
| 6 | `useNewLeadFlow.ts` → `ConfirmationStep.tsx` (Novo Lead) | Vendedor | CNH (nome, CPF, RG, nascimento, categoria, validade) | Parcial (nome/CPF editáveis; RG/CNH/validade não aparecem) |
| 7 | `MigracaoDiretaDialog.tsx` / `MigracaoStepForm.tsx` | Vendedor | Comprovante (CPF, placa, data) | Sem edição |
| 8 | `AnaliseVistoria.tsx` + `chassi-ocr` (vistoria) | Vistoriador / analista | Chassi do veículo via foto | Só visualização |

### O que vou construir

**1. Componente reutilizável `OcrDadosEditor`** (`src/components/ocr/OcrDadosEditor.tsx`)
- Recebe: `dados` (Record), `tipoDocumento`, `onSave(dadosEditados)`, `confianca?`, `documentoId?`
- Renderiza um card com:
  - Badge de confiança do OCR
  - Campos editáveis dinamicamente conforme o tipo (CNH → nome, CPF, RG, nascimento, número, categoria, validade; CRLV → placa, chassi, renavam, marca, modelo, ano, cor, combustível, blindado; RG → nome, CPF, RG, nascimento; Comprovante → CPF, endereço, data; etc.)
  - Botão "Editar" / "Salvar" / "Cancelar"
  - Botão "Preencher manualmente" quando OCR falha (`sucesso=false` ou `legivel=false`) — abre os mesmos campos vazios
  - Máscaras (CPF, placa, data) reaproveitando `MaskedInputs`
- Sem mexer no arquivo anexado (mantém `arquivo_url` intocado, conforme pedido)

**2. Esquema de campos por tipo** (`src/components/ocr/ocr-fields-schema.ts`)
- Mapa central `OCR_FIELDS_SCHEMA[tipo] = [{ key, label, mask?, required? }]`
- Garante consistência entre todos os pontos e facilita futuras adições

**3. Persistência das edições**
- **Documentos com tabela própria**:
  - `documentos.dados_extraidos` (jsonb) — atualizar via `update`
  - `contratos_documentos.ocr_resultado` (jsonb) — atualizar campo `dados` dentro do JSON
  - `vistorias.chassi_ocr` — campo escalar, atualizar direto
- **Fluxos sem persistência intermediária** (Novo Lead, Migração): atualiza apenas o `state` local; submissão final usa o valor editado

**4. Integração nos 8 pontos**

| Ponto | Integração |
|---|---|
| 1. CotacaoPublicaCompleta | Após OCR do CRLV, mostrar `OcrDadosEditor` antes de aplicar à cotação. Salva via `atualizarCotacao` |
| 2. DocumentosPendentesPublico | Card por documento enviado, edita `dados_extraidos` no banco |
| 3. UnifiedDocumentUploader | Substitui o preview de "3 campos" por `OcrDadosEditor` expansível por documento |
| 4. DocumentUploader (legado) | Mesmo componente, expansível |
| 5. useContratoDocumentos | Já roda dentro do (4) — sync de CNH usa dados editados |
| 6. ConfirmationStep (Novo Lead) | Adicionar campos faltantes (RG, número CNH, categoria, validade); todos editáveis com badge "extraído da CNH" |
| 7. Migração | Card editor para CPF/placa/data dos comprovantes |
| 8. AnaliseVistoria | Adicionar botão "Editar chassi extraído" no card de validação; salva `chassi_ocr` e recalcula `chassi_validacao` (compara com `veiculo.chassi`) |

**5. UX consistente**
- Quando OCR retorna `sugestao='reprovar'` ou `legivel=false`: editor abre **automaticamente em modo edição** com aviso "Não conseguimos ler o documento — preencha manualmente abaixo"
- Quando OCR sugere `revisar`: badge amarelo "Revise os dados extraídos" + editor colapsado
- Quando OCR aprova: editor colapsado com botão discreto "Editar"
- Audit: cada edição grava `dados_extraidos.editado_manualmente=true` e `dados_extraidos.editado_em` para rastreabilidade

### Garantias

- **Documentos anexados continuam intactos** — só os campos extraídos são editáveis
- **Não altera regras de elegibilidade nem motor de cotação** — apenas substitui valores extraídos pelos editados antes do uso
- **Validação preservada**: comparações de placa/CPF (UnifiedDocumentUploader) re-rodam após edição
- **Sem hardcode** — schema de campos editável é centralizado mas extensível
- **Backwards compatible**: documentos antigos (sem flag de edição) continuam funcionando

### Arquivos afetados

**Criar**:
- `src/components/ocr/OcrDadosEditor.tsx`
- `src/components/ocr/ocr-fields-schema.ts`

**Editar**:
- `src/pages/public/CotacaoPublicaCompleta.tsx`
- `src/components/cotacao-publica/DocumentosPendentesPublico.tsx`
- `src/components/contratos/UnifiedDocumentUploader.tsx`
- `src/components/contratos/DocumentUploader.tsx`
- `src/components/leads/new-lead-flow/ConfirmationStep.tsx`
- `src/components/cadastro/MigracaoDiretaDialog.tsx`
- `src/components/contratos/MigracaoStepForm.tsx`
- `src/pages/cadastro/AnaliseVistoria.tsx`

**Banco**: nenhuma migração necessária — os campos `dados_extraidos`/`ocr_resultado`/`chassi_ocr` já existem.

