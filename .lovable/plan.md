

# Forçar Gemini a executar tools: solução definitiva

## Problema confirmado

A conversa do Marcus Vinícius Faustinoni está salva em `chat_mensagens_ia` e mostra o modelo **fabricando protocolos** (SIN-20260402-001, guincho) em texto puro, sem nunca chamar as tools `criar_solicitacao_sinistro` ou `criar_solicitacao_assistencia`. Resultado: zero registros nas tabelas `sinistros` e `chamados_assistencia`.

A instrução "REGRA CRÍTICA DE EXECUÇÃO" adicionada anteriormente ao prompt **não foi suficiente** — o Gemini Flash continua narrando.

## Causa raiz

`tool_choice: "auto"` permite ao modelo ignorar tools. O prompt é muito longo (~1400 linhas incluindo contexto) e o Gemini Flash prioriza fluência textual sobre execução de tools nesse cenário.

## Solução

### Arquivo: `supabase/functions/assistente-chat/index.ts`

**1. Trocar `tool_choice` de `"auto"` para forçar uso de tools quando o contexto indica ação**

Implementar detecção de intenção de ação na mensagem do usuário. Quando a mensagem indica sinistro/assistência/colisão/roubo/guincho, usar `tool_choice: "required"` em vez de `"auto"`. Isso obriga o modelo a chamar uma tool.

Lógica:
```ts
const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
const actionKeywords = ['sinistro', 'colisao', 'colisão', 'batida', 'bateu', 'roubo', 'furto', 
  'guincho', 'reboque', 'assistencia', 'assistência', 'pane', 'chaveiro', 'pneu',
  'isso mesmo', 'sim', 'confirmo', 'pode registrar', 'minha residencia', 'minha residência',
  'registrar', 'abrir'];
const isActionContext = actionKeywords.some(kw => lastUserMsg.includes(kw));

// Em chamadas após tool results, manter "auto"
const toolChoice = isActionContext ? "required" : "auto";
```

Aplicar isso nas **duas chamadas fetch** ao gateway (linhas ~1281 e ~1366).

**2. Adicionar validação pós-resposta: detectar protocolos fabricados**

Após receber a resposta final do modelo, verificar se o texto contém padrões como "SIN-" ou "ASS-" sem que nenhuma tool tenha sido chamada. Se detectado, fazer uma segunda tentativa com `tool_choice: "required"`.

```ts
const fabricatedProtocol = /SIN-\d{8}-\d{3,4}|ASS-\d{8}-\d{3,4}/.test(finalContent);
const noToolsUsed = iterations === 0;
if (fabricatedProtocol && noToolsUsed) {
  console.warn('[assistente-chat] Protocolo fabricado detectado! Forçando tool call...');
  // Retry com tool_choice: "required"
}
```

**3. Simplificar o system prompt para reduzir a chance de narração**

Mover a seção "REGRA CRÍTICA DE EXECUÇÃO" para o **início absoluto** do system prompt (antes de qualquer outra instrução), e tornar mais curta e direta:

```
REGRA #1: NUNCA gere protocolos (SIN-*, ASS-*) em texto. Protocolos só existem quando uma tool retorna.
REGRA #2: Para registrar qualquer coisa, CHAME a tool. Não narre.
```

### Redeploy

Deploy da edge function `assistente-chat` após as alterações.

## Impacto
- 1 arquivo alterado (~20 linhas)
- O modelo será forçado a chamar tools quando o contexto indicar ação
- Protocolos fabricados serão detectados e corrigidos
- Sinistros e assistências passarão a ser registrados no banco

