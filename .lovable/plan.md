## Revisão item-a-item dos 9 requisitos

| # | Requisito | Status | Observação |
|---|-----------|--------|------------|
| Menu | "Chat" em **Relacionamento** | OK | `AppSidebar.tsx` linha 234-241, grupo `relacionamento` com item `Chat` → `/eventos/chat-ia` |
| 1 | Layout WhatsApp Web (lista + painel) | OK (com ressalva) | `EventosChatIA.tsx`: `ConversasList` à **esquerda** (w-80) + `ChatPanel` à direita. *Seu texto inverte os lados, mas WhatsApp Web é assim mesmo — mantido o padrão WA.* |
| 2 | Rolagem automática | OK | `ChatPanel.tsx` linhas 68-76, `useEffect` rola para o fim quando `mensagens` muda |
| 3 | Clicar conversa abre no painel | OK | `handleSelectConversa` |
| 4 | Continuar conversa humana (texto/áudio/arquivo) | OK | Texto via `whatsapp-send-text`; áudio gravado via MediaRecorder + `whatsapp-send-media`; arquivos (imagem/vídeo/doc) via paperclip → `whatsapp-send-media` |
| 5 | Apenas provedor ativo (WhatsApp) | **Parcial** | Filtra por `whatsapp_instancias.ativa=true` (hoje só existe 1 instância Evolution). Não checa `provedor='evolution'/'meta'` explicitamente — se um dia houver instância "ativa" de outro canal não-WhatsApp aparecerá. **Ajuste recomendado.** |
| 6 | Clicar nome do contato abre detalhes (associado) | OK | Header é `<button>` que abre `ContatoDetalheDrawer` (busca em `associados` por telefone/whatsapp, mostra nome, status, email, link "Abrir cadastro completo") |
| 7 | Intervenção humana pausa IA por 10 min a partir da última mensagem | OK | `pausarPorIntervencao()` é chamado **após cada envio** (texto, áudio, arquivo) — `ChatPanel.tsx` linhas 113 e 149. Como upserta `pausada_ate = now() + 10min` a cada envio, o contador efetivamente reinicia a cada nova mensagem. Edge `processar-fila-ia` (linhas 44-62) verifica `whatsapp_ia_pausas` e marca itens como `pausado_humano` |
| 8 | Botão "Encerrar atendimento" → mensagem amigável + IA reativa em 1 min | OK | `ContatoDetalheDrawer.handleEncerrar` envia texto via `whatsapp-send-text` e chama `pausarPorEncerramento()` (1 min) |
| 9 | Mensagem de encerramento sem template | OK | Usa `whatsapp-send-text` (texto livre), não `whatsapp-send-template` |

## Ajustes propostos

### A. Filtrar conversas estritamente por provedor WhatsApp (Req. 5)
Em `EventosChatIA.tsx`, alterar a query `whatsapp-instancias-ativas` para também restringir provedores WhatsApp:

```ts
.from('whatsapp_instancias')
.select('id')
.eq('ativa', true)
.in('provedor', ['evolution', 'meta']) // somente provedores WhatsApp
```

Assim, se futuramente houver instâncias de outros canais (SMS, Telegram, etc.) elas serão excluídas automaticamente.

### B. Remover entrada duplicada "Chat Cobrança" do menu Financeiro (opcional — confirmar)
Hoje existe **um segundo item** `Chat Cobrança` em `Financeiro` (`AppSidebar.tsx` linha 291) que aponta para `/cobranca/chat` e renderiza o mesmo componente `EventosChatIA`. Como o Chat agora é canônico em **Relacionamento**, mantê-lo duplicado pode confundir.

→ **Pergunta abaixo** para você decidir.

### C. Mensagem visual quando IA está pausada (já existe)
Já implementado: badge "IA pausada até HH:mm" no header do `ChatPanel` + bloco amarelo no drawer. Sem ajuste necessário.

### D. Verificação extra na edge function (já implementada)
`processar-fila-ia` já consulta `whatsapp_ia_pausas` e descarta itens enquanto a pausa estiver ativa, marcando-os como `pausado_humano`. Sem ajuste necessário.

## Detalhes técnicos do ajuste A

Arquivo: `src/pages/eventos/EventosChatIA.tsx`
Mudança: 1 linha adicional `.in('provedor', ['evolution', 'meta'])` no `queryFn` de `whatsapp-instancias-ativas`. Sem migrações, sem edge function.

## Pergunta de decisão

Antes de aplicar, preciso confirmar o item B (duplicidade do "Chat Cobrança" no Financeiro).
