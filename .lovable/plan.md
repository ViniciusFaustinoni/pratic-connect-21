## Objetivo

Permitir que o diretor escolha **qual motor faz o OCR de documentos** (CNH, RG, CRLV, ATPV-e, comprovante, NF), incluindo o **Mistral OCR** (`mistral-ocr-latest`, API `/v1/ocr`) — sem afetar o provedor global de IA usado em chat, análise de risco, WhatsApp etc.

Bônus crítico que o seu segundo ponto destravou: hoje o retry de baixa confiança está hardcoded em `google/gemini-2.5-pro`, **mesmo quando o provedor global é Anthropic**. Isso vai ser corrigido junto.

---

## O que muda para o diretor

Em **Configurações → Inteligência Artificial**, abaixo do card atual "Provedor e modelo globais", aparece um **segundo card: "Motor de OCR de documentos"** com 4 opções:

1. **Usar o provedor global** (padrão atual — comportamento de hoje)
2. **Mistral OCR** (`mistral-ocr-latest` — API especializada em documentos)
3. **Anthropic Claude** (Sonnet 4.5 / Opus 4.5)
4. **Google Gemini** (2.5 Pro / Flash)

Para cada opção (exceto "global"), um select de modelo. A escolha vale **só para `document-ocr`** — chat, Maya, Vinicius, análise de sinistro etc. continuam no provedor global.

---

## Regra de retry (resposta ao seu segundo ponto)

Hoje: confiança < 0.6 → retry forçado em `google/gemini-2.5-pro`, ignorando o provedor escolhido.
Depois: o retry usa **um modelo "potente" do mesmo provedor do OCR**:

| Motor de OCR escolhido | Primeira passada | Retry baixa confiança |
|---|---|---|
| Mistral OCR | `mistral-ocr-latest` | `pixtral-large-latest` (visão) |
| Anthropic | `claude-haiku-4-5` | `claude-sonnet-4-5` |
| Google | `gemini-2.5-flash` | `gemini-2.5-pro` |
| Lovable Gateway | modelo escolhido | versão "pro" do mesmo |

Coerente com a sua observação: se o provedor global está em Anthropic, **nunca** caímos em Gemini sem o diretor pedir.

---

## Detalhes técnicos

### 1. Banco
Migration adicionando tabela `ocr_engine_config` (singleton, igual `ai_model_config`):
```
id uuid PK
engine text  -- 'global' | 'mistral' | 'anthropic' | 'google'
model text   -- ex: 'mistral-ocr-latest', 'claude-haiku-4-5', etc.
retry_model text  -- modelo do retry (auto-preenchido pela UI)
updated_at, updated_by
```
RLS: SELECT autenticado, UPDATE só diretor (mesma policy do `ai_model_config`).

### 2. Secret
`MISTRAL_API_KEY` via `add_secret` (eu peço quando aprovar). Endpoint: `https://api.mistral.ai/v1/ocr`.

### 3. Edge function `document-ocr/index.ts`
- Lê `ocr_engine_config` no início da request.
- Se `engine = 'global'` → comportamento atual (intacto).
- Se `engine = 'mistral'` → novo branch que chama `/v1/ocr` com `document.document_url` (URL assinada do Storage) ou `image_url` base64. Retorno do Mistral é **markdown estruturado**, então adicionamos um pós-processador que extrai os campos do schema Pratic (CNH/CRLV/etc) usando o próprio prompt JSON atual numa segunda chamada leve (`mistral-small-latest`) — ou, se for documento simples, parse por regex já cobre.
- Se `engine = 'anthropic'` ou `'google'` → reutiliza pipeline atual mudando só o `model` passado para `callAIGatewayWithRetry`.
- `OCR_RETRY_MODEL` deixa de ser constante e passa a vir de `ocr_engine_config.retry_model`.
- Logs em `ocr_execution_logs` ganham coluna `engine` (qual motor foi usado) — facilita comparar qualidade depois.

### 4. Frontend
- Novo hook `useOcrEngineConfig` (espelho do `useAIModelConfig`).
- Novo componente `OcrEngineConfigCard` colocado em `IntegracaoIA.tsx` abaixo do card existente.
- Mapa estático `OCR_ENGINE_MODELS` com modelos válidos por motor + retry padrão sugerido.

### 5. Coluna `model` nos logs
Há um bug conhecido (do diagnóstico anterior): logs gravam `gemini-2.5-flash` quando rodou Claude. Vai ser corrigido nesta mesma passada — passa a gravar o modelo realmente usado em cada passada (primária e retry).

---

## Não faz parte deste plano
- Não troca o provedor global (continua Lovable/OpenAI/Anthropic).
- Não migra o OCR existente para Mistral automaticamente — diretor precisa escolher.
- Não mexe em outros usos de IA (chat, risco, WhatsApp).
- Não adiciona Mistral à lista de modelos globais (você pediu "só para OCR").

---

## Riscos
- **Mistral OCR retorna markdown, não JSON estruturado.** Precisamos de uma camada de extração — incluí no plano um segundo passo leve com `mistral-small-latest` para mapear ao schema Pratic. Se essa abordagem mostrar baixa precisão na CNH/CRLV em testes, alternativa é manter Mistral só para "extrair texto bruto" e usar o LLM global para estruturar — fácil de pivotar depois.
- **Sem créditos Mistral configurados** → erro 401/402; tratamos como `fallback: true` (igual hoje com Anthropic).