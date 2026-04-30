## Diagnóstico do PDF que você enviou

CNH-e SENATRAN/CDT, 1 página. Camada de texto contém **440 caracteres só de instruções** ("instale o Assinador Serpro..."), **zero dado da CNH** (nome/CPF/validade estão dentro de imagens embutidas). O sistema atual envia o PDF inteiro à IA e a IA recebe um documento de "baixa densidade textual visual", o que provoca leituras incompletas/divergentes — exatamente o que você está vendo em produção.

**Renderizando essa mesma página como JPEG 200dpi**, todos os campos ficam perfeitamente nítidos: CPF `124.936.497-37`, nome `MARCUS VINICIUS FAUSTINONI DE FREITAS`, validade `18/01/2033`, categoria `D`. Esse é o caminho.

---

## O que será entregue

### 1. PDF→Imagem antes do envio à IA (correção principal)

No `document-ocr/index.ts`, antes de qualquer chamada à IA:

1. Se entrada é PDF, **rasterizar a primeira página** (e até a 3ª se houver) em **JPEG 200dpi** usando `pdfium` via `npm:@hyzyla/pdfium` (funciona em Deno edge runtime, sem dependência de poppler/system binaries).
2. **Heurística de "página com dados"**: pegar a página com maior densidade de imagens e/ou texto via `unpdf`. Para CNH/CRLV digitais (1 página) é trivial; para PDFs longos (proposta) escolhe a primeira página com >100 chars OU a primeira que contém imagens.
3. Enviar **a imagem renderizada** (não o PDF) para a IA, junto com o texto nativo extraído como contexto auxiliar.
4. Fallback: se rasterização falhar (PDF criptografado, formato exótico), cai para o comportamento atual de enviar o PDF cru.

Resultado: **a IA recebe uma imagem nítida da CNH em vez de um PDF de "instruções do Assinador Serpro"**.

### 2. Card "Motor de OCR" no `IntegracaoIA.tsx`

Logo abaixo do card global de IA. 4 motores escolhíveis pelo diretor (vale **só** pra `document-ocr`, não afeta chat/Maya/risco):

| Motor | Modelo principal | 2ª opinião (CNH/CRLV) |
|---|---|---|
| **Mistral OCR** | `mistral-ocr-latest` (API `/v1/ocr`) | `pixtral-large-latest` |
| **Anthropic Claude** | `claude-sonnet-4-5` | `claude-opus-4-5` |
| **Google Gemini** | `gemini-2.5-pro` | `gemini-2.5-pro` (prompt reforçado) |
| **Provedor global** (default) | herda `ai_model_config` | mesmo provedor, modelo "pro" |

Para Mistral, mesmo bloco de chave de API que já existe (input mascarado, badge Configurada/Não, Salvar/Remover). Endpoint do Mistral para OCR já trabalha **direto com PDFs e imagens**, não precisa rasterização — quando engine = mistral, manda PDF original; nos outros engines, manda a imagem rasterizada.

### 3. Sempre o melhor modelo possível

Hoje a primeira passada usa modelo "leve" (Flash/Haiku). Vai mudar para **`claude-sonnet-4-5`** quando engine = anthropic e **`gemini-2.5-pro`** quando engine = google. Você foi explícito: produção crítica = melhor modelo. Diretor pode trocar pelo card se quiser.

### 4. Dupla leitura em CNH e CRLV

Quando `tipo_esperado ∈ {cnh, crlv}`:
1. Passada A → motor escolhido com modelo principal.
2. Passada B → motor secundário (configurável; default Claude Sonnet 4.5 quando engine for outro).
3. **Comparador** roda no edge: campos críticos por tipo
   - CNH: `cpf, nome, numero_registro, validade, categoria`
   - CRLV: `placa, renavam, chassi, ano, marca_modelo, cor`
4. Decisão:
   - 100% iguais → `aprovar`, confiança = max(A,B) + 0.1.
   - Diverge em 1 campo crítico → `revisar` com diff salvo em `divergencias` (jsonb).
   - Diverge em ≥2 críticos OU em CPF/placa → `em_analise` obrigatório, ambos JSONs salvos.
5. Demais documentos (RG, comprovante, NF, foto veículo) → leitura única (regra atual).
6. Custo extra: ~+1 chamada por CNH/CRLV (~10–15% do volume).

### 5. Mistral OCR de verdade

Branch `runMistralOcr()` no `document-ocr/index.ts`:
- Cria signed URL do Storage (ou usa data-URI base64 quando upload direto) e chama `POST https://api.mistral.ai/v1/ocr` com `{model: "mistral-ocr-latest", document: {type: "document_url", document_url}}` ou `{type: "image_url"}`.
- Mistral devolve markdown estruturado por página + bbox.
- **Estruturação para schema Pratic**: o markdown é passado para `pixtral-large-latest` (chat com visão) com o mesmo system prompt JSON do Pratic, retornando `{tipo_detectado, dados, sugestao, confianca}`.
- Tratamento explícito: 401 (chave inválida) / 402 (sem créditos) / 429 (rate limit) → toast claro e `fallback: true` no payload (UI não quebra).

### 6. Bugs colaterais corrigidos

- **Log do modelo errado**: hoje grava `gemini-2.5-flash` mesmo rodando Anthropic. Vai gravar o modelo real (`primary_model`, `secondary_model`).
- Coluna `engine` em `ocr_execution_logs` (mistral/anthropic/google/global) + `dupla_leitura boolean` + `divergencias jsonb` + `pdf_rasterizado boolean` para diagnóstico futuro.

---

## Detalhes técnicos

### Banco — 1 migration
```sql
create table public.ocr_engine_config (
  id uuid primary key default gen_random_uuid(),
  engine text not null default 'global'
    check (engine in ('global','mistral','anthropic','google')),
  primary_model text not null default 'mistral-ocr-latest',
  secondary_model text default 'claude-sonnet-4-5',
  dupla_leitura_tipos text[] not null default array['cnh','crlv'],
  pdf_rasterizar boolean not null default true,
  pdf_dpi int not null default 200,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.ocr_execution_logs
  add column if not exists engine text,
  add column if not exists primary_model text,
  add column if not exists secondary_model text,
  add column if not exists dupla_leitura boolean default false,
  add column if not exists divergencias jsonb,
  add column if not exists pdf_rasterizado boolean default false,
  add column if not exists pdf_paginas_rasterizadas int;
-- RLS espelhando ai_model_config (SELECT autenticado, INSERT/UPDATE diretor/desenvolvedor)
```

### Edge function `document-ocr/index.ts`
- Novo helper `rasterizePdfPage(uint8Array, dpi=200, page=1)` usando `@hyzyla/pdfium` → retorna `Uint8Array` JPEG.
- Roteador no início da request lê `ocr_engine_config`.
- Se PDF e `engine !== 'mistral'` e `pdf_rasterizar = true`: rasteriza página 1 (CNH/CRLV têm 1) e envia JPEG para a IA (mantém texto nativo do `unpdf` como contexto suplementar).
- Se `engine === 'mistral'`: chama `runMistralOcr()` com PDF original.
- Comparador `compareCriticalFields(resA, resB, tipo)` quando aplicável.

### Edge function `ai-secret-manager`
- Suportar `provider: 'mistral'` (set/remove/status) com secret `MISTRAL_API_KEY`.

### Frontend
- `src/hooks/useOcrEngineConfig.ts` (espelho do `useAIModelConfig`).
- `src/components/integracoes/OcrEngineConfigCard.tsx` — design espelha o card global.
- `src/hooks/useAIProviderKeys.ts`: estender `ProviderName` com `'mistral'` e mapear nome de chave.
- `IntegracaoIA.tsx`: monta `<OcrEngineConfigCard />` abaixo do `<AIModelConfigCard />`.

### Secret necessário
- **`MISTRAL_API_KEY`** — vou solicitar pelo widget de secrets quando começar a implementação.

### Memória atualizada
- `mem://infrastructure/documents/ocr-resilience-and-cnh-parsing-v4` → v5 com: rasterização PDF→JPEG por padrão, motor configurável por tela, dupla leitura em CNH/CRLV, retry respeita provedor.

---

## Fora deste plano
- Não muda provedor global de IA (chat/Maya/risco/WhatsApp continuam intactos).
- Não adiciona Mistral nas opções globais (só no card de OCR).
- Não mexe em fotos de veículo / vistoria / laudo (escopo é OCR de documentos).
- Não troca `unpdf` (extração nativa continua como contexto auxiliar quando útil).