## Diagnóstico — por que a IA "esquece" o template

Reproduzindo o cenário do print (cron matinal envia `confirmacao_manha_v1` → usuário responde "SIM" → IA responde "Identifiquei seu cadastro, ligue para a central"):

1. **Histórico da IA não vê templates.** `getConversationHistory` em `supabase/functions/whatsapp-webhook/index.ts` (linha 1852) lê **apenas** `chat_mensagens_ia`. Toda saída via template Meta (cron de confirmação, cobrança CSV, lembretes, etc.) é gravada **somente** em `whatsapp_mensagens` com `tipo='template'`. Para a IA, o template nunca existiu — a primeira mensagem do "thread" é o "SIM" solto.

2. **Gate de confirmação do webhook Evolution está desatualizado.** Em `whatsapp-webhook/index.ts:3304` o filtro é `['enviada','reagendando','aguardando_confirmacao_vespera']`, faltando `aguardando_confirmacao_manha` e `aguardando_confirmacao_encaixe`. O `whatsapp-meta-webhook` (linha 260) já corrigiu isso, mas se a resposta entrar pelo canal Evolution o "SIM" cai direto na IA, sem casar com a confirmação pendente.

3. **Templates enviados não criam entrada no fio da IA.** Mesmo que o gate de confirmação não exista (ex.: template de cobrança, lembrete genérico), não há *nenhum* mecanismo que registre "system: enviei template X com o conteúdo Y" para o contexto.

## Plano de correção

### 1. Fonte única de histórico para a IA (raiz do problema)
Reescrever `getConversationHistory` (whatsapp-webhook/index.ts) para mesclar duas fontes nas últimas 2h e ordenar por tempo:
- `chat_mensagens_ia` (já existente — texto livre IA/usuário).
- `whatsapp_mensagens` por telefone do associado **incluindo `tipo='template'`**, com `direcao` mapeada para `role` (`saida`→`assistant`, `entrada`→`user`).

Para templates, montar o `content` como o texto renderizado do template (campo `mensagem` quando preenchido) com prefixo curto `[Template enviado: <codigo>]` quando útil. Dedup por `message_id` para não duplicar com `chat_mensagens_ia`.

### 2. Persistir conteúdo renderizado dos templates
Garantir que toda função que dispara template Meta grava em `whatsapp_mensagens` o **texto final renderizado** (com variáveis já substituídas) no campo `mensagem`, não só `template_id`. Auditar e ajustar:
- `confirmar-vistorias-manha-cron`
- `disparar-cobranca-csv-meta` (já grava — apenas confirmar conteúdo)
- `enviar-confirmacao-manual`, `enviar-lembretes-vencimento`, `notificar-*`, `enviar-termo-*`
Padronizar via helper único `saveOutboundTemplate(supabase, { telefone, instancia_id, template_codigo, template_params, mensagem_renderizada, referencia_tipo, referencia_id })`.

### 3. Alinhar gate de confirmação no canal Evolution
Em `whatsapp-webhook/index.ts:3304`, ampliar o filtro para `['enviada','reagendando','aguardando_confirmacao_vespera','aguardando_confirmacao_manha','aguardando_confirmacao_encaixe']` (paridade com o webhook Meta).

### 4. Reforço no system prompt da IA
Adicionar instrução curta: "Se as últimas mensagens incluem um template do tipo confirmação/cobrança/lembrete, trate a resposta do associado (SIM/NÃO/REAGENDAR/etc.) como continuação desse fluxo — nunca como mensagem fria."

### 5. Validação
- Disparar manualmente `confirmar-vistorias-manha-cron` para um telefone de teste, responder "SIM" e verificar nos logs do `whatsapp-webhook` que `getConversationHistory` retorna a mensagem do template e que o ramo de `confirmacaoPendente` casa.
- Repetir simulando entrada via Evolution e via Meta.
- Caso negativo: enviar template de cobrança (sem `confirmacoes_agendamento`) e verificar que a IA, ao receber pergunta do associado sobre "o boleto", referencia o conteúdo do template no contexto.

## Arquivos previstos para alteração
- `supabase/functions/whatsapp-webhook/index.ts` (history merge + filtro de status + prompt)
- `supabase/functions/_shared/` novo helper `saveOutboundTemplate.ts` (a criar)
- `supabase/functions/confirmar-vistorias-manha-cron/index.ts`
- `supabase/functions/enviar-confirmacao-manual/index.ts`
- `supabase/functions/disparar-cobranca-csv-meta/index.ts` (ajuste mínimo de campos)
- demais funções de envio de template (auditoria + uso do helper)

## Fora de escopo
- Não mexer no schema de `whatsapp_mensagens`/`chat_mensagens_ia`.
- Não alterar UX do link público nem fluxo de cotação.
