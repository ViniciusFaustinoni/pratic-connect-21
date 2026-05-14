## Diagnóstico

**O envio Meta funciona — mas as conversas NÃO aparecem no Chat IA Maya.**

### O que está OK
- Edge function `disparar-cobranca-csv-meta` chama corretamente `graph.facebook.com/v21.0/.../messages` com o template `cobranca_inadimplencia_pratic` (parâmetros `{{1}}=nome` e `{{2}}=blocos de boletos`).
- Sanitização Meta (#132000/#132018), validação de DDD/celular BR, deduplicação por associado (1 mensagem por matrícula, no máx. 3 blocos), throttle entre blocos (1.5s) e entre destinatários (250ms) — tudo conforme as regras Meta.
- Lotes recentes (13/05) **incrementam `total_enviados` corretamente**: 2, 11, 11, 15 envios efetivos contabilizados em `cobranca_csv_lotes`.
- Boletos enviados são marcados como `status='enviado'` em `cobranca_csv_boletos`.
- Instância `provedor='meta'` ativa existe em `whatsapp_instancias`.

### O bug
A tabela `whatsapp_mensagens` (que alimenta o Chat IA Maya em `/eventos/chat-ia`) tem:
- **0 registros** com `referencia_tipo='cobranca_csv'`
- **0 registros** com `provedor='meta'`

Mesmo com **39 envios contabilizados nos lotes**, nenhum chegou na tabela de mensagens — logo, **nenhuma conversa de cobrança CSV aparece no Chat IA Maya**.

A edge function tenta inserir nas linhas 494-512 (sucesso) e 527-545 (erro), mas o erro é apenas logado com `console.error("[whatsapp_mensagens insert ok]", insErr.message)` e ignorado — falha silenciosa.

## Plano de correção

### 1. Reproduzir e capturar o erro real do INSERT
Adicionar instrumentação na edge `disparar-cobranca-csv-meta`:
- Promover os `console.error` dos 2 INSERTs em `whatsapp_mensagens` para também aparecerem no payload de retorno (campo `warnings[]`) quando ocorrerem, para inspeção imediata na UI.
- Logar o objeto inteiro do erro (code, details, hint), não só `.message`.

### 2. Tornar o INSERT robusto
Causas prováveis do INSERT falhar silenciosamente (a investigar com o log real):
- Algum trigger `BEFORE INSERT` em `whatsapp_mensagens` rejeitando `tipo='template'` + `referencia_tipo='cobranca_csv'`.
- Tamanho do `template_variaveis.boletos` (jsonb com boletos completos por destinatário com 18+ boletos) excedendo limite de algum trigger downstream.
- Trigger que tenta resolver `referencia_id` exigindo UUID válido quando `referencia_tipo` está setado.

Ações conforme causa identificada:
- Se trigger: ajustar para aceitar `referencia_tipo='cobranca_csv'` sem `referencia_id` (esse fluxo usa `lote_id` no `template_variaveis`, não tem cobrança individual).
- Se payload: enxugar `template_variaveis.boletos` (gravar só `placa + vencimento`, não o objeto completo).

### 3. Garantir agregação correta no Chat IA Maya
Confirmado que `EventosChatIA.tsx` linha 153 já reconhece `'cobranca_csv'` como tipo de cobrança e mostra o badge `ultima_cobranca`. Nenhuma alteração de UI necessária — basta as mensagens entrarem na tabela.

### 4. Validação
Após correção, disparar 1 lote pequeno (5–10 destinatários) e verificar:
- `select count(*) from whatsapp_mensagens where referencia_tipo='cobranca_csv'` > 0
- A conversa aparece em `/eventos/chat-ia` com o template renderizado e badge de cobrança recente
- Quando o associado responder, a Maya tem o contexto correto da cobrança no histórico

### Fora do escopo
- Backfill das 39 mensagens já enviadas é impossível (o `message_id` da Meta foi perdido — só os contadores ficaram).
- Mudanças no fluxo de envio Meta em si (que está correto).

## Detalhes técnicos
- Arquivo: `supabase/functions/disparar-cobranca-csv-meta/index.ts` linhas 494-512 e 527-545.
- Tabela alvo: `public.whatsapp_mensagens` (RLS é bypass via SERVICE_ROLE_KEY na edge, então não é problema de policy).
- UI do chat: `src/pages/eventos/EventosChatIA.tsx` (já compatível).
