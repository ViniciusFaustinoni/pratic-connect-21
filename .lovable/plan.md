

# Diagnóstico: Chat IA não registra sinistro/assistência

## Problema identificado

Os logs mostram claramente que **todas as mensagens recentes** retornam `"Modelo retornou texto puro (sem tool_calls)"`. O modelo `google/gemini-3-flash-preview` está apenas respondendo com texto descritivo (ex: "vou registrar seu sinistro...") mas **nunca chama as tools** `criar_solicitacao_sinistro` ou `criar_solicitacao_assistencia`. Sem tool call, nada é inserido no banco.

## Causa raiz

Dois fatores combinados:

1. **System prompt muito longo e complexo** (~170 linhas) com muitas regras condicionais. O modelo Gemini Flash tende a "narrar" as etapas em vez de executar as tools quando o prompt é denso demais.

2. **`tool_choice: "auto"`** dá ao modelo a liberdade de ignorar as tools. Quando o modelo decide que precisa "coletar mais dados primeiro", ele entra num loop de perguntas textuais e nunca chega a chamar a tool — mesmo quando já tem todas as informações.

## Solução

### 1. Arquivo: `supabase/functions/assistente-chat/index.ts`

**Adicionar instrução explícita e enfática no system prompt** para forçar o uso de tools:

```
## REGRA CRÍTICA DE EXECUÇÃO
NUNCA descreva que vai executar uma ação — EXECUTE-A chamando a tool correspondente.
Quando tiver dados suficientes (tipo, local, descrição), chame a tool IMEDIATAMENTE.
NÃO peça confirmação final se todos os dados já foram coletados na conversa.
Se o usuário disse o que aconteceu, onde e quando — chame criar_solicitacao_sinistro ou criar_solicitacao_assistencia.
```

**Adicionar log do conteúdo da mensagem do modelo** quando não houver tool_calls, para podermos auditar o que ele respondeu:

```ts
if (!assistantMessage?.tool_calls) {
  console.log(`[assistente-chat] Resposta texto: ${assistantMessage?.content?.substring(0, 200)}`);
}
```

**Adicionar log do número de mensagens e histórico** enviado ao modelo para debugar se o contexto está sendo passado:

```ts
console.log(`[assistente-chat] Enviando ${aiMessages.length} mensagens ao modelo (${conversationHistory.length} do histórico)`);
```

### 2. Redeploy da Edge Function

Após as alterações, fazer redeploy de `assistente-chat`.

## Impacto
- 1 arquivo alterado (edge function)
- ~10 linhas adicionadas
- O modelo passará a executar as tools em vez de apenas descrever as ações
- Logs melhorados para auditoria futura

