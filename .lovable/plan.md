Mudanças na área **Relacionamento › Chat** (Maya IA + ChatPanel manual).

---

## 1. Emoji picker nas respostas manuais

**Onde:** `src/components/eventos/chat-ia/ChatPanel.tsx` (barra inferior do composer, ao lado dos botões anexo/microfone — L524-572).

**Como:** adicionar um botão `Smile` (lucide) que abre um Popover com `emoji-picker-react` (já leve, ~80kb gz). Ao escolher, insere o emoji na posição do cursor do `<Textarea>` (`texto`/`setTexto` + `textareaRef.current.selectionStart`).

Sem mexer em lógica de envio nem em outros chats — só esse composer (o de Eventos/Relacionamento usa o mesmo ChatPanel).

---

## 2. Maya enviando a mesma mensagem 2× (print 15:49)

A frase "Tamo junto, Rodrigo! 🤝 Precisado de qualquer outra ajuda…" é um **encerramento padrão da Maya** disparado em duplicidade. O dedupe de **incoming** (`whatsapp_mensagens.message_id`) está OK (L3224-3236 do `whatsapp-webhook`); o dedupe canônico de **claim** (`agente_ia_locks` + RPC `claim_proximos_itens_fila_ia` — memória core) também existe. Então o duplo provavelmente nasce **dentro de uma única execução do agente** (loop de tool_calls que chama `whatsapp-send-text` mais de uma vez com o mesmo texto, ou texto de encerramento enviado tanto pelo agente quanto por algum hook pós-tool).

**Plano antes de corrigir** (não dá pra "consertar às cegas" — duplicação de IA exige reproduzir/medir primeiro):

a. Puxar `edge_function_logs` de `whatsapp-webhook` filtrando pelo telefone `5521983864722` e pela janela 15:48-15:50 para ver se houve **1 invocação com 2 envios** ou **2 invocações independentes**.
b. Conferir `whatsapp_mensagens` (direção=saida) desse contato no mesmo minuto: se `message_id` Meta for diferente → 2 envios reais; se idêntico → render duplicado no painel (front).
c. Conforme o achado:
   - **2 envios reais na mesma invocação** → adicionar dedupe por hash de conteúdo (telefone + texto normalizado) na própria `whatsapp-send-text` com janela curta (ex.: 60 s), no padrão da memória `Dedup cobrança mesmo dia`.
   - **2 invocações** → checar bucket de `agente_ia_locks` (memória diz bucket de 30 s) e se o claim RPC está sendo realmente chamado pelo caminho da Maya (não só pelo cron).
   - **Render duplicado** → corrigir o componente de mensagens do ChatPanel para deduplicar por `message_id` antes de renderizar.

Sem a leitura dos logs/banco eu não sei qual dos 3 é — então a Mudança 2 entra em **investigação primeiro, fix depois**, como leva separada.

---

## 3. Assistência 24h no system prompt da Maya

**Onde:** `supabase/functions/whatsapp-webhook/index.ts`, `buildWhatsappSystemPrompt` (L261+), nova seção logo abaixo de "Capacidades".

**Conteúdo a injetar** (texto exato):

> ## ASSISTÊNCIA 24H — TELEFONES OFICIAIS
> Quando o associado pedir **número de emergência**, **reboque**, **guincho** ou **assistência 24h** (e o pedido for só pelo CONTATO, não pela abertura de chamado pelo WhatsApp), envie:
> - 📞 Central 24h: **0800 980 0001**
> - 📱 WhatsApp 24h: **(21) 97093-5732**
>
> Se o associado quiser **abrir o chamado por aqui mesmo**, siga o fluxo normal de `criar_solicitacao_assistencia` (continua valendo). Os telefones acima são para quando ele quer o número direto.

Sem mexer em tools, sem mexer no fluxo de abrir sinistro/assistência. Só adiciona conhecimento ao prompt.

---

## 4. Procedimento de login do rastreador no system prompt da Maya

**Onde:** mesmo arquivo/função, mesma seção nova.

**Conteúdo a injetar** (texto exato):

> ## LOGIN/SENHA DO APP DE RASTREAMENTO
> Quando o associado pedir **login**, **senha**, acesso ao **aplicativo de monitoramento/rastreador** ou quiser **rastrear o veículo pelo app**, responda:
> - "Para liberar seu acesso ao app de rastreamento, envie um e-mail para **rastreador@praticcar.org** solicitando login e senha. Em pouco tempo nossa equipe responde com os dados de acesso. 🛰️"
>
> NÃO crie protocolo, NÃO chame tool — esse fluxo é **só orientação por e-mail**.

---

## Ordem de aplicação (uma leva por vez, igual ao padrão recente)

1. **Mudança 1** (emoji picker) — isolada, frontend puro, fácil de validar.
2. **Mudanças 3 + 4** (system prompt) — uma só edição no `buildWhatsappSystemPrompt`, deploy da edge `whatsapp-webhook`, validação no WhatsApp real ou no `WhatsAppTestChat`.
3. **Mudança 2** (duplicação) — primeiro investigação com `edge_function_logs` + query nas tabelas `whatsapp_mensagens` e `agente_ia_locks` para o telefone do print, depois proposta de fix dirigida à causa.

## Detalhes técnicos

- Emoji picker: usar `emoji-picker-react` (já existe no ecossistema; se não estiver instalado, `bun add emoji-picker-react`). Render dentro de `Popover` do shadcn pra casar com o tema escuro do ChatPanel.
- System prompt: as duas seções novas ficam acima de "Coleta de Dados para SINISTRO" pra ganhar prioridade de leitura do modelo.
- Não tocar em `processar-fila-ia`, em `agente_ia_locks`, nem em `whatsapp-send-text` antes da investigação da Mudança 2.

## Fora do escopo

- Não estou refazendo o composer de outros chats (Vinicius, teste WhatsApp).
- Não estou mexendo no Maya app/Solicitar Assistência (só no fluxo via WhatsApp).
- Não estou alterando templates Meta.
