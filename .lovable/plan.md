# Trocar modelo da habilidade `relacionamento` para `google/gemini-2.5-pro`

## Objetivo
Subir a qualidade conversacional da Maya (habilidade `relacionamento`) trocando o flash atual por um modelo Gemini Pro, sem afetar nenhum outro consumo de IA do sistema (OCR, análise de risco, chat de assistente, etc.) e sem alterar regras/FAQ/tools/transbordo/identificação.

## Modelo escolhido
- **Primário:** `google/gemini-2.5-pro` — top da família Gemini no Lovable AI Gateway, estável (não-preview), bom em conversa natural + raciocínio + janelas grandes (importante porque o systemPrompt da Maya é longo: persona + FAQ + contexto de cobrança/agendamento).
- **Por que não 3.x preview:** `google/gemini-3-pro-preview` é mais novo, mas preview pode mudar/quebrar sem aviso — risco alto pra atendimento 24/7.
- **Fallback:** `google/gemini-3-flash-preview` (= `DEFAULT_CONFIG` do `_shared/ai-client.ts`, idêntico ao flash atual). Se o pro falhar, atendimento degrada exatamente para o nível de hoje, nada pior.

## Por que precisa de override por habilidade
- `ai_model_config` é **global** (afeta OCR, risco, chat, etc.) — trocar lá viola o escopo "só relacionamento".
- Hoje `aiGatewayFetch` ignora o `model` passado pelo caller e força o da DB. Isso significa que o `model: "google/gemini-3-flash-preview"` hardcoded na linha 2000 de `agente-consultor-ia/index.ts` é **código morto**: o modelo real vem de `ai_model_config` (`anthropic/claude-sonnet-4-5`) e, como Anthropic está sem crédito (400), cai no fallback Lovable com `google/gemini-3-flash-preview`. A Maya hoje, na prática, está rodando flash.

## Mudanças

### 1. `supabase/functions/agente-consultor-ia/index.ts`
- Trocar a chamada `aiGatewayFetch({...})` (linhas ~1993–2006) por `callAI({...})` (importado de `_shared/ai-client.ts`) com `override` explícito:
  - `override: { provider: "lovable", model: "google/gemini-2.5-pro" }`
  - `fallbackToLovable: true` (default — preserva queda para `DEFAULT_CONFIG` se algo falhar).
- Reaproveitar o resto do loop (tool calls, validador, etc.) sem alterações funcionais. Apenas adaptar o consumo da resposta (`callAI` devolve `{ ok, status, data }` já no shape OpenAI — alinhar com `aiData = result.data`).
- Tratamento 429/402 mantido — `callAI` propaga `status`.
- Remover a linha morta `model: "google/gemini-3-flash-preview"` (substituída pelo override).
- Adicionar log explícito por turno: `[agente-consultor-ia][modelo] used=<modelo_real_da_resposta>` lendo `aiData.model` do retorno (todo provider devolve esse campo) — serve de evidência por turno.

**Não tocar em mais nada** desse arquivo: roteamento, gates de identificação, prompt, tools, fallbacks de vácuo, transbordo, dedupe, locks — tudo igual.

### 2. `supabase/functions/_shared/ai-client.ts`
- **Nenhuma alteração.** O `DEFAULT_CONFIG` (`google/gemini-3-flash-preview`) já é o fallback desejado. Outras edges (OCR, risco, chat) continuam usando o `ai_model_config` global — fora do escopo.

### 3. Banco
- **Sem migração.** Modelo per-skill fica hardcoded no edge da habilidade (única habilidade que precisa hoje). Se no futuro `vendas` (Vinicius) também quiser modelo próprio, dá pra evoluir para uma coluna `ia_habilidades.modelo_ia` — mas não nesta entrega (você pediu para não inflar escopo).

## Pontos NÃO tocados (confirmação explícita)
- `ai_model_config` (DB) — permanece `anthropic/claude-sonnet-4-5`.
- Outras edges que chamam IA (`assistente-chat`, `analise-risco-ia`, `document-ocr`, `whatsapp-template-validar`, etc.) — intocadas.
- `ia_habilidades` (regras, FAQ, persona, tom, gates) — intocado.
- Roteador, tools (`consultar_boletos_associado`, `consultar_situacao_veiculo`, `solicitar_atendente_humano`), transbordo, identificação, gate de CPF, validador de saída — intocados.

## Validação em produção (obrigatória antes de fechar)

1. `deploy_edge_functions(["agente-consultor-ia"])` explícito.
2. `curl_edge_functions` → invocar o agente com payload real do contato Marcos (CPF 14194896742): mensagem curta tipo "oi" ou "vc tem o boleto?".
3. `edge_function_logs(agente-consultor-ia, search="[modelo] used=")` — extrair o `aiData.model` do turno real. Tem que ser `gemini-2.5-pro`, **não** `gemini-3-flash-preview` nem `claude-sonnet-4-5`.
4. Confirmar no mesmo turno que o agente respondeu coerentemente (identificou o associado, retornou boleto / situação) — sanity check de que a troca não quebrou nada.
5. Reportar no chat:
   - Modelo ativo confirmado por chamada real: `google/gemini-2.5-pro` (com evidência do log).
   - Fallback: `google/gemini-3-flash-preview` (via `DEFAULT_CONFIG` do `ai-client.ts`).
   - Pontos de configuração: 1 (override no `agente-consultor-ia/index.ts`). Linha morta antiga removida. `ai_model_config` global não foi tocado e continua governando o resto do sistema.

## Riscos & mitigação
- **Gemini 2.5 Pro mais lento que flash** → max_tokens já é 2048, timeout 55s — margem suficiente. Se latência subir demais em produção, plano B é trocar para `google/gemini-2.5-flash` (intermediário). Sem mudança de arquitetura.
- **Tool calling com Pro pode variar formato** → 2.5-pro suporta tool calling no formato OpenAI igual ao flash, sem ajustes esperados. Validação E2E no passo 3/4 cobre isso.
- **Custo por turno sobe** → esperado (Pro > Flash). Fora do escopo desta entrega.
