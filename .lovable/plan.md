
## Diagnóstico

A Kelly respondeu "Sim" via WhatsApp (Meta), mas o sistema:

1. **Não atualizou** `confirmacoes_agendamento` (continua `status='enviada'`, `resposta_cliente=null`).
2. **Não atualizou** `servicos.confirmacao_whatsapp` (continua `null`).
3. **Não respondeu** à Kelly via IA confirmando o recebimento.
4. **Não atualizou** o pino no mapa.

### Causa raiz (3 bugs encadeados)

**BUG A — `whatsapp-meta-webhook` referencia colunas inexistentes**
O código tenta gravar em `confirmacoes_agendamento.telefone_formatado`, `intencao_detectada`, `respondido_em`, `resposta_associado`. A tabela real tem: `telefone`, `resposta_cliente`, `resposta_recebida_em`. Resultado: o `.update()` falha silenciosamente OU o `.select(...).or('telefone_formatado.in.(...)')` retorna 400 e o fluxo cai fora.

**BUG B — Mensagem entra na `whatsapp_fila_ia` em vez de processar confirmação**
O `whatsapp-meta-webhook`, ao detectar associado ativo, **enfileira** na `whatsapp_fila_ia` para o agente IA (Maya) e nunca chama `processarRespostaConfirmacaoMeta` — porque a checagem de confirmação pendente é feita ANTES, mas com query quebrada (BUG A). Resultado: a Kelly cai no fluxo padrão da IA Maya.

**BUG C — Dedup mata o reprocessamento**
O `processar-fila-ia` invoca `whatsapp-webhook` com o **mesmo `message_id`** original (linha 79). O `whatsapp-webhook` (linha 2904-2914) faz dedup por `message_id` e descarta. Confirmação nunca chega ao bloco que faria o trabalho.

**BUG D — Resposta IA não foi disparada**
Como o item caiu no fluxo de associado ativo (após dedup falhar), o agente Maya deveria responder. Mas a Maya não tem prompt/ferramenta para reconhecer "Sim isolado" como confirmação de agendamento — ela responde como dúvida ou fica em silêncio.

## Plano de correção

### 1) Corrigir `whatsapp-meta-webhook` (alinhar com schema real)

- Trocar `telefone_formatado` por apenas `telefone` na busca.
- Trocar campos de UPDATE: `resposta_associado → resposta_cliente`, `respondido_em → resposta_recebida_em`, remover `intencao_detectada` (ou criar coluna se quiser histórico).
- Trocar `status="sucesso"` por `status="confirmada"` (alinhar com whatsapp-webhook Evolution).
- Trocar `confirmacao_whatsapp: true` (boolean) por `'confirmada'` (string) — coluna é text.
- Trocar `confirmacao_whatsapp_em` por `confirmado_via_whatsapp_em`.

### 2) Garantir que o webhook Meta processa confirmação ANTES da fila IA

Reordenar: PRIMEIRO checar confirmação pendente (com query corrigida) → se achar, processar e retornar. SÓ DEPOIS enfileirar para Maya.

### 3) Disparar push + invalidação realtime do mapa

Após confirmar:
- `servicos.confirmacao_whatsapp = 'confirmada'` + `confirmado_via_whatsapp_em = now()` → realtime já atualiza o mapa (a tabela `servicos` tem realtime habilitado).
- Push para vistoriador atribuído (já existe lógica em `whatsapp-webhook`).
- Atualizar `confirmacoes_agendamento` → realtime para popups que escutam.

### 4) Resposta natural via IA

Em vez de string fixa, gerar resposta humanizada via Lovable AI Gateway (mesmo modelo já usado no projeto). Conteúdo: agradecer pelo nome, lembrar dia/hora/endereço, dizer que técnico será designado.

Fallback determinístico se IA falhar (mantém string atual `"✅ Agendamento *confirmado*..."`).

### 5) Blindar `processar-fila-ia` contra dedup

Quando o item da fila for marcado como **resposta de confirmação**, NÃO reprocessar via `whatsapp-webhook` (já tratado pelo Meta direto). Marcar `status='concluido'` na fila e seguir.

Alternativa mais simples: passar `_skip_dedup: true` no payload sintético quando vier da fila E o `processar-fila-ia` ler isso para pular dedup. Adicionar bypass no `whatsapp-webhook`.

Vou pela alternativa simples: adicionar flag `_from_queue` (já existe!) ao bypass de dedup, OU usar `message_id` diferente (`queue_<id>`) quando reenviar.

### 6) Mapa — pino reflete confirmação

Verificar `MapaVistoriasContent.tsx`:
- Pino muda de cor/badge quando `confirmacao_whatsapp = 'confirmada'`.
- Popup mostra "✅ Confirmado via WhatsApp" em vez de só "Status: agendada".

Se faltar, adicionar badge no popup e cor diferenciada no marker.

### 7) Bug colateral de timezone no popup

O popup mostrou "Agendada: 16/04/2026" mas o serviço é `2026-04-18`. Verificar se `MapaVistoriasContent.tsx` está usando o helper `formatDateBR` corrigido anteriormente. Se ainda usar `new Date(string)` direto, trocar.

## Arquivos a tocar

- `supabase/functions/whatsapp-meta-webhook/index.ts` — fix colunas + ordenar checagem confirmação + IA.
- `supabase/functions/processar-fila-ia/index.ts` — usar `message_id` único no reenvio (ex.: `queue_<itemId>`) para evitar dedup.
- `supabase/functions/whatsapp-webhook/index.ts` — opcional: pular dedup quando `_from_queue=true` e checar confirmação primeiro.
- `src/components/mapa/MapaVistoriasContent.tsx` — badge "Confirmado via WhatsApp" + cor do pino + corrigir formato de data se necessário.
- (opcional) Adicionar coluna `intencao_detectada text` em `confirmacoes_agendamento` para auditoria.

## Não vou mexer

- Schema da tabela `servicos`.
- Fluxo de envio inicial (`enviar-confirmacao-manual`).
- Lógica do agente Vinicius.
- Dedup global do `whatsapp-webhook` (mantém para outros fluxos).

## Resultado

Quando qualquer associado responder "Sim" (ou variantes) à mensagem de confirmação:
1. Meta-webhook reconhece imediatamente, atualiza `confirmacoes_agendamento` e `servicos`.
2. Cliente recebe resposta amigável da IA: *"Perfeito, Kelly! ✅ Sua presença está confirmada para sábado 18/04 às 09h..."*.
3. Pino no mapa muda de cor + badge "✅ Confirmado via WhatsApp" aparece no popup, em tempo real.
4. Vistoriador atribuído (se houver) recebe push notification.
