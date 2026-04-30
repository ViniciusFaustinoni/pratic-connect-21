## Objetivo

Permitir que o usuário escolha o **provedor de IA** (Lovable AI Gateway, OpenAI direto, Anthropic direto) e o **modelo específico** em um único lugar (`Configurações → Integrações → WhatsApp → IA & Respostas`). A escolha vale para **TODAS** as funcionalidades de IA do sistema, inclusive leitura de documentos (OCR).

## Escopo

### 1. Banco de dados

Nova tabela `ai_model_config` (singleton — uma linha global) com migração:

```
- id (uuid, pk)
- provider (text: 'lovable' | 'openai' | 'anthropic')
- model (text: ex.: 'google/gemini-3-flash-preview', 'gpt-5.2', 'claude-sonnet-4-5')
- updated_by (uuid, profiles)
- updated_at (timestamptz)
```

RLS: SELECT para qualquer usuário autenticado (edge functions via service role); UPDATE/INSERT só para diretores/desenvolvedores.

Tabela auxiliar opcional **não criada** — lista de modelos por provedor fica hardcoded no front (atualizável via deploy).

### 2. Secrets necessários (sob demanda)

- `LOVABLE_API_KEY` — já existe.
- `OPENAI_API_KEY` — solicitado ao usuário ao escolher OpenAI pela primeira vez (se ainda não existir).
- `ANTHROPIC_API_KEY` — solicitado ao escolher Anthropic.

A UI mostra um aviso "Chave não configurada — clique para adicionar" quando o provedor selecionado exige uma chave ausente.

### 3. Helper compartilhado (novo)

Criar `supabase/functions/_shared/ai-client.ts` exportando:

- `getActiveAIConfig(supabase)` — lê `ai_model_config`; fallback `{provider:'lovable', model:'google/gemini-3-flash-preview'}`.
- `callAI({ messages, tools?, response_format?, stream?, imageInputs? })` — roteia transparentemente:
  - **lovable** → `https://ai.gateway.lovable.dev/v1/chat/completions` (formato OpenAI compatível, payload e tools idênticos ao atual).
  - **openai** → `https://api.openai.com/v1/chat/completions` (mesmo shape OpenAI).
  - **anthropic** → `https://api.anthropic.com/v1/messages` com adaptador (converte messages/tools OpenAI-style → Anthropic e resposta de volta).
- Trata 429/402 e devolve erros padronizados.
- Suporta visão (imageInputs) — necessário para OCR; se Anthropic, converte para blocks `image`.

### 4. Refator das edge functions de IA

Substituir todas as chamadas diretas a `ai.gateway.lovable.dev` pelo novo `callAI()`. Funções afetadas:

```
analise-risco-ia, assistente-chat, agente-consultor-ia,
document-ocr, chassi-ocr, odometro-ocr,
analise-consistencia-relatos, melhorar-texto-relato-erro,
pesquisar-antecedentes, gerar-prompt-correcao-erro,
formatar-texto-ia, gerar-mensagem-whatsapp,
gerar-descricao-linha, sugerir-ressalva-ia,
extract-orcamento-pdf, whatsapp-webhook,
whatsapp-template-validar, whatsapp-meta-webhook
```

`gerar-imagem-plano` permanece em Lovable Gateway (geração de imagem; OpenAI/Anthropic não são equivalentes diretos — registramos isso como limitação visível).

OCR (`document-ocr`, `chassi-ocr`, `odometro-ocr`): mantém a lógica de retry; só troca o transport. Se o modelo selecionado não for multimodal, faz fallback automático para `google/gemini-3-flash-preview` no Lovable Gateway e loga aviso.

### 5. UI — novo card "Modelo de IA"

Localização: `src/pages/configuracoes/IntegracaoWhatsApp.tsx` aba **IA & Respostas**, acima do `WhatsAppIAConfig`.

Componente novo: `src/components/integracoes/AIModelConfigCard.tsx`

```text
┌─ Modelo de IA (global) ─────────────────────┐
│ Provedor: [ Lovable AI ▾ ]                  │
│ Modelo:   [ google/gemini-3-flash-preview ▾]│
│                                             │
│ ⓘ Aplicado a: OCR, Chat IA, Consultor,      │
│   Análise de risco, WhatsApp e demais       │
│   automações.                               │
│                                             │
│ [Salvar]                                    │
└─────────────────────────────────────────────┘
```

Listas de modelos:
- **Lovable**: gemini-3-flash-preview, gemini-3.1-pro-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.2.
- **OpenAI** (direto): gpt-5.2, gpt-5, gpt-5-mini, gpt-4.1, gpt-4o, o4-mini.
- **Anthropic**: claude-sonnet-4-5, claude-opus-4-1, claude-haiku-4-5, claude-3-7-sonnet.

Se provedor exige chave ausente, exibe alerta com botão "Adicionar chave" (abre instruções) — bloqueia salvar.

Acesso restrito a diretor / desenvolvedor (via `usePermissions`).

### 6. Hook front

`src/hooks/useAIModelConfig.ts` — TanStack Query (`select` + `update`) com invalidação.

## Fora do escopo

- Não criamos UI por funcionalidade (modelo único global, conforme pedido).
- Modelo de geração de imagem fica fixo no Lovable Gateway (a UI deixa isso explícito).

## Critérios de aceite

1. Trocar para `openai/gpt-5.2` faz o `assistente-chat` responder via OpenAI direto (verificável nos logs).
2. Trocar para `anthropic/claude-sonnet-4-5` faz o `document-ocr` processar uma CNH usando Anthropic.
3. Ausência de `OPENAI_API_KEY` ao salvar OpenAI bloqueia gravação com mensagem clara.
4. Sem configuração salva, sistema continua funcionando com fallback Lovable + gemini-3-flash-preview (zero regressão).
