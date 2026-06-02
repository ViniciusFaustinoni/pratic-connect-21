## Diagnóstico do caso Rafael (KRH3I99)

Olhei o histórico dele em `whatsapp_mensagens` (telefone 5521979225815) e o código de `agente-consultor-ia` + `whatsapp-webhook` + `processar-fila-ia`. Dois problemas reais:

### 1) Transbordo não existe — a IA está mentindo
O prompt do branch `isAssociado` (linha 556–589 de `agente-consultor-ia/index.ts`) só manda a IA "redirecionar para o número da Central". Não há **nenhuma tool** para abrir transbordo, criar chamado ou pausar a IA.

Resultado: nas mensagens de 29/05, 01/06 e 02/06, o Rafael pediu retorno 5+ vezes e a Maya respondeu coisas como *"Já fiz a solicitação para o setor responsável"*, *"Vou reforçar agora mesmo a sua solicitação com a nossa equipe de Relacionamento"*, *"Já deixei um novo alerta aqui para o time de Relacionamento"* — **sem chamar absolutamente nada**. É alucinação pura: nenhuma notificação, fila ou pausa foi criada.

A única forma hoje de o atendimento humano assumir é o operador clicar manualmente no chat (pausa de 10 min via `whatsapp_ia_pausas`).

### 2) Duplicidade — cada resposta sai 2x com ~200 ms
Confirmado nos registros:
- 11:20:35.709 e 11:20:35.931 — *"Bom dia, Rafael!"* duplicado
- 11:20:41.451 e 11:20:41.643 — *"Oi, Rafael! Poxa…"* duplicado
- 11:21:48.899 e 11:21:49.110 — duplicado
- 11:22:37.723 e 11:22:37.929 — duplicado

`agente-consultor-ia` chama `enviarWhatsApp` 1x por parte. `processar-fila-ia` roda a cada minuto e seleciona `status IN ('pendente','erro')` **sem lock e sem CAS** — duas execuções concorrentes pegam o mesmo item antes do `UPDATE status='processando'`. Provavelmente é o cron + chamada do webhook real entrando em paralelo, gerando duas invocações do agente para a mesma mensagem.

---

## Plano

### Parte A — Botão de Transbordo de verdade (substitui as falsas promessas)

**A1. Nova tool `abrir_transbordo_relacionamento` no `agente-consultor-ia`**
- Disponível nos branches `isAssociado` **e** `lead` (não para diretor).
- Parâmetros: `motivo` (enum: `aguardando_retorno`, `reclamacao`, `pediu_humano`, `sinistro_emergencia`, `assunto_fora_escopo`, `outros`), `resumo` (string curta) e `prioridade` (`normal` | `alta`).
- Efeito:
  1. `INSERT` em `whatsapp_ia_pausas` com `motivo='transbordo_relacionamento'` e `pausada_ate = now() + 24h` (operador encerra com o botão *Concluir atendimento* que já existe — sem mexer no fluxo de 10 min de intervenção humana).
  2. `INSERT` em `notificacoes_sistema` com `destino_role='relacionamento'` (e `coordenador_monitoramento` como fallback) — segue o padrão das memórias `analises-relacionamento-ingestao` e `handoff-notificacoes-sistema-sem-realtime`.
  3. `INSERT` em `agente_ia_transbordos` (nova tabela) com `{ telefone, contato_id, associado_id?, motivo, resumo, prioridade, status='aberto', aberto_em }` — fonte da verdade para a fila do Relacionamento e auditoria.
  4. Resposta única e fixa ao cliente: *"Já chamei a equipe de Relacionamento aqui, {nome}. Eles vão te responder por este mesmo WhatsApp assim que pegarem o seu atendimento. Pode aguardar. 🙏"* — **a IA não escreve mais nada depois disso na mesma rodada**.

**A2. Reescrita do prompt do associado (branch `isAssociado`)**
- Trocar o atual *"sempre redirecione para o telefone"* por uma matriz curta de gatilhos que **obrigam** a tool:
  - cliente diz *"sem retorno"*, *"ninguém me ligou"*, *"quero falar com humano/atendente/pessoa"*, *"emergência/sinistro"*, ou repete a mesma queixa duas vezes → chamar `abrir_transbordo_relacionamento`.
  - dúvidas operacionais simples (horário, número da central, o que é Praticcar) → responder direto, sem transbordo.
- Regras absolutas adicionais: **proibido prometer "vou solicitar", "vou reforçar", "já avisei o time", "fiz a solicitação"** sem ter chamado a tool. Inclui exemplos negativos.
- Após chamar a tool, ignorar qualquer follow-up do cliente até o operador encerrar a pausa (a checagem de `whatsapp_ia_pausas` já existe em `processar-fila-ia` e em `agente-consultor-ia`).

**A3. Mesmo gatilho no branch lead**
- Mesma tool, mesma regra para `quero falar com pessoa`, `sinistro`, `reclamação grave`. Hoje existe só um regex frouxo (linhas 1082–1117) que muda `status='atendimento_humano'` — vamos unificar tudo nessa tool nova e descontinuar o caminho regex.

**A4. UI da fila de transbordo (mínimo viável)**
- Em `/eventos/chat-ia`, adicionar chip *"Transbordo Relacionamento (N)"* no topo da lista de conversas (lendo `agente_ia_transbordos` aberto).
- Badge no card da conversa indicando motivo + tempo aberto.
- O botão **"Concluir atendimento"** já existente no `ChatPanel` passa a também marcar `agente_ia_transbordos.status='concluido'` (além de remover a pausa).

### Parte B — Eliminar a duplicidade

**B1. Travar a fila com claim atômico no `processar-fila-ia`**
- Trocar `SELECT ... status IN ('pendente','erro')` + `UPDATE status='processando'` por um `UPDATE ... RETURNING *` com `WHERE status IN ('pendente','erro') AND tentativas < 3` em CTE/`FOR UPDATE SKIP LOCKED` (via RPC). Só processa o item se conseguir o claim — duas instâncias concorrentes não pegam o mesmo registro.

**B2. Idempotência por mensagem no `agente-consultor-ia`**
- Adicionar uma janela curta de dedupe: antes de chamar o modelo, verificar se já existe `whatsapp_mensagens` saída para o mesmo `telefone` cujo `referencia_id` aponte para a mesma mensagem de entrada nos últimos 30 s. Se sim, abortar com `{success:true, ignored:"duplicate_inflight"}`. Defesa em profundidade caso B1 falhe.

**B3. Bloquear reentrada no `whatsapp-webhook`**
- O dedup atual (linha 3184, por `message_id`) só vale para o caminho "real" do Meta. Quando a fila reinjeta com `id: queue_${item.id}` (`processar-fila-ia` linha 101), ele escapa do dedup de propósito. Adicionar dedupe complementar por `(telefone + hash(mensagem) + janela 10s)` antes de delegar ao agente — assim a combinação webhook real + reinjeção da fila para a mesma mensagem original deixa de gerar duas respostas.

### Parte C — Higiene e observabilidade
- Migração: nova tabela `agente_ia_transbordos` (com GRANTs e RLS — `select/update` para roles internas, `insert` só via service role) + índice em `(status, aberto_em)`.
- Adicionar `console.log` estruturado `[transbordo]` para auditoria.
- Atualizar a memória `mem://logic/integrations/maya-contexto-template-meta` (ou criar nova `mem://logic/operations/transbordo-relacionamento-canonico`) registrando: "Maya nunca promete ação humana sem chamar `abrir_transbordo_relacionamento`; tabela canônica = `agente_ia_transbordos`; pausa = `whatsapp_ia_pausas motivo='transbordo_relacionamento'`."

---

## Detalhe técnico — arquivos afetados

```text
supabase/migrations/<ts>_agente_ia_transbordos.sql        (novo)
supabase/migrations/<ts>_claim_fila_ia_rpc.sql            (novo — RPC com SKIP LOCKED)
supabase/functions/agente-consultor-ia/index.ts           (tool nova + prompts + dedupe)
supabase/functions/processar-fila-ia/index.ts             (usa RPC de claim)
supabase/functions/whatsapp-webhook/index.ts              (dedupe por hash p/ reentrada)
src/components/eventos/chat-ia/ConversasList.tsx          (chip transbordo)
src/components/eventos/chat-ia/ChatPanel.tsx              (encerra transbordo no Concluir)
src/hooks/eventos/useTransbordoRelacionamento.ts          (novo)
```

## Fora de escopo deste plano
- Roteamento por skill (sinistro vs cobrança vs cancelamento) — fica como evolução.
- Métricas/SLA de tempo de resposta do Relacionamento.
- Reativação automática da IA depois de N minutos sem operador responder — só botão manual por enquanto.
