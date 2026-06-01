## Diagnóstico

Validei nos logs e no banco:

1. Operador envia "Boa tarde resposta" em `/eventos/chat-ia` para `5521982244909` às 18:59:02.
2. Edge `whatsapp-send-text` loga **`✓ Meta: ... wamid.HBgN...`** → Meta API aceitou e o associado recebeu no celular.
3. Imediatamente depois aparece **`shutdown`** da function e **NENHUM** `[whatsapp-send-text] ⚠️ Falha ao persistir` é logado.
4. Query no banco em `whatsapp_mensagens` por esse `message_id` / `telefone` / janela horária: **0 linhas saída após 18:58:30**. Nem a resposta da Maya nem a do operador foram persistidas.
5. Tabela `whatsapp_mensagens` não tem trigger BEFORE INSERT, não é particionada, `status='enviada'` e `tipo='text'` estão dentro do CHECK, e não há UNIQUE em `message_id`. RLS é bypassado (service role).

### Causa raiz

O código-fonte de `supabase/functions/whatsapp-send-text/index.ts` **já** tem `status: "enviada"` + captura de `insertErr`. Mas o runtime que respondeu às 18:59 **não emitiu o log de erro nem persistiu**. Duas hipóteses, ambas tratadas pelo plano:

- **A — Deploy desatualizado**: a versão rodando ainda é a antiga (`status: 'enviada_texto_livre'`), que violava o CHECK do `whatsapp_mensagens.status` e o `insert(...)` sem destruturar `error` engolia o `PostgrestError` silenciosamente. Como Lovable às vezes atrasa o deploy de edge functions, **precisamos forçar redeploy**.
- **B — Algum outro erro de insert que continue passando despercebido** (ex.: payload com campo inesperado em outro caminho `insert` anterior à correção). Vamos blindar: logar erro com `JSON.stringify` e devolver `persisted:false` na resposta da function para o front conseguir reagir.

A regra de negócio que o usuário descreveu (IA responde sempre, operador interrompe naquela conversa, Transbordo lista os interrompidos) **já está correta** — `pausarPorIntervencao()` é por telefone e dura 10 min; outros contatos seguem com a IA. Não precisa mexer.

## Plano

### 1. Forçar redeploy do edge function `whatsapp-send-text`
Garante que a versão em execução é a que tem `status: "enviada"` + captura de `insertErr`.

### 2. Blindar persistência e observabilidade no `whatsapp-send-text/index.ts`
- Trocar todos os `await supabase.from("whatsapp_mensagens").insert({...})` que ainda **não** destruturam `error` (existe pelo menos no `retry #1 button split` e no caminho Evolution) para `const { error: insertErr } = await ...` e logar com `console.error("[whatsapp-send-text] insert FAIL:", JSON.stringify(insertErr))`.
- Incluir `persisted: !insertErr` no objeto de retorno do caminho Meta (success path) para o front saber se gravou.

### 3. Render otimista no `ChatPanel.tsx`
Mesmo com persistência consertada, há um gap de ~1 s entre o `invoke` retornar e o `refetch`/realtime trazer a linha. Hoje a bolha do operador some nesse intervalo. Solução:

- Manter uma `pendingMessages` state local: ao clicar enviar, empurra `{ id: tempId, telefone, mensagem, direcao:'saida', status:'enviando', created_at: now() }`.
- Concatenar `pendingMessages` ao array de `mensagens` na renderização, deduplicando por `message_id` quando o registro real chegar via realtime/refetch.
- Se a edge devolver `persisted: false` ou `error`, marcar a pendente como `status:'erro'` com botão "Reenviar".

### 4. Verificação
- Enviar uma mensagem manual em `/eventos/chat-ia` para um número com janela 24h aberta.
- Conferir no banco: `SELECT * FROM whatsapp_mensagens WHERE direcao='saida' AND created_at > now() - interval '2 minutes'` retorna a linha.
- Conferir no chat: a bolha aparece imediatamente (otimista) e persiste após o refetch.
- Conferir no log do edge: aparece `✓ Meta:` e **nenhum** `insert FAIL`.

## Arquivos tocados

- `supabase/functions/whatsapp-send-text/index.ts` — blindagem dos `insert` restantes + `persisted` no retorno.
- `src/components/eventos/chat-ia/ChatPanel.tsx` — render otimista + estado `pendingMessages` + reenviar.
- (Operação) Redeploy explícito de `whatsapp-send-text`.

## Fora de escopo

- A regra "IA continua para outros contatos" já está correta (pausa por telefone, 10 min). Não mexer.
- Transbordo já existe em `/relacionamento/transbordos` (`TransbordosRelacionamento.tsx` + `useTransbordosAtivos`). Não duplicar.
