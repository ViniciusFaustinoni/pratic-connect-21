## Diagnóstico

A tela `/eventos/chat-ia` mostra apenas as mensagens recebidas (entrada) dos clientes — as respostas enviadas pela Maya/agentes via Chatwoot nunca aparecem.

**Causa raiz confirmada no banco:**
- Últimos 7 dias: 54 mensagens `referencia_tipo='chatwoot'`, **todas `direcao='entrada'`**. Zero saídas Chatwoot.
- As únicas saídas persistidas são de outros canais (`cobranca_csv` e Evolution/Meta direto, `referencia_tipo=NULL`).
- No caso da Julia Gurgel (+55 21 98579-1044), só existem 2 entradas (`Oioi`, `Oie`) — as respostas que a IA/operador enviaram pelo Chatwoot não foram gravadas.

**Origem do bug** — `supabase/functions/chatwoot-webhook/index.ts` linhas 48-55:
```ts
// message_type 0 = incoming (contato enviou)
if (messageType !== 0 && messageType !== "incoming") {
  // ignora silenciosamente — saídas nunca chegam ao whatsapp_mensagens
  return { ignorado: true, motivo: "Mensagem não é incoming" };
}
```
O webhook descarta toda mensagem `outgoing` do Chatwoot, então a saída do agente/Maya nunca é gravada e a UI fica sem o lado direito da conversa.

## Plano

Editar **apenas** `supabase/functions/chatwoot-webhook/index.ts`:

1. **Aceitar `message_type` outgoing** (Chatwoot usa `1` ou `"outgoing"`) além do incoming já tratado. Continuar ignorando `template`/`activity` (tipos 2 e 3).
2. Determinar `direcao` pelo tipo:
   - incoming (0) → `entrada` (comportamento atual)
   - outgoing (1) → `saida` (novo)
3. Para saídas, **não enfileirar na `whatsapp_fila_ia`** — só entradas devem disparar a IA. O bloco de fila/dispatch fica condicionado a `direcao === 'entrada'`.
4. Para saídas, preservar `nome_contato` (continua sendo o nome do contato/cliente para agrupamento) e usar o mesmo `messageId` (`chatwoot_<source_id>`) para o `message_id` — o backfill natural cuida do resto.
5. Adicionar log dedicado `[chatwoot-webhook] Saída registrada (tel: ...)` para auditoria.

Nada muda no frontend: `ChatPanel` já renderiza saídas no lado direito quando `direcao !== 'entrada'`, e `EventosChatIA` já inclui mensagens com `instancia_id IS NULL`.

## Fora de escopo

- Backfill das saídas históricas que já foram descartadas (não dá pra recuperar — Chatwoot não reenvia).
- Mudanças visuais na bolha "Maya IA" vs "Agente humano" (hoje tudo que não é entrada é rotulado "Maya IA"; podemos separar depois se quiser distinguir agente humano vs bot).

## Validação

Após o deploy, qualquer nova resposta enviada pela Maya/agente no Chatwoot aparecerá no Chat IA do lado direito em tempo real (Realtime já está montado no `ChatPanel`).
