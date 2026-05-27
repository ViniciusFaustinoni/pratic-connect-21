# Não Lidos em Relacionamento › Chat

Hoje a aba Relacionamento › Chat (`/eventos/n` → `EventosChatIA.tsx`) lista conversas WhatsApp agrupadas por telefone sem nenhuma noção de "lido / não lido" do lado do operador. A coluna `whatsapp_mensagens.read_at` existente é o *read receipt do destinatário* (quando o cliente leu a nossa mensagem) — não serve para marcar o que o operador interno já visualizou.

A solução é por-operador: cada usuário interno tem o próprio "last seen" por conversa.

## Comportamento

- Cada conversa exibe contador de mensagens **não lidas** = mensagens `direcao='entrada'` com `created_at > last_read_at` daquele operador.
- Toggle no topo da lista: **Todas** / **Não lidos** (preserva filtro de busca).
- Conversas com não lidos: nome em **negrito**, badge com a contagem (verde), ordem de prioridade no topo da lista quando o filtro "Não lidos" estiver ativo.
- Ao **abrir** uma conversa, o `last_read_at` daquele operador é atualizado para `now()` automaticamente (upsert) — o badge some.
- Botão secundário discreto **"Marcar todas como lidas"** acima da lista (apenas quando há não lidas).
- Funciona em tempo real: Realtime já existente em `whatsapp_mensagens` invalida a query; a contagem se recalcula sem reload.

## Escopo backend

Nova tabela `whatsapp_conversa_leituras`:

| coluna | tipo | obs |
|---|---|---|
| `user_id` | uuid | FK lógico para `auth.users` |
| `telefone` | varchar | mesmo formato do `whatsapp_mensagens.telefone` |
| `last_read_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | trigger padrão |

- PK composta `(user_id, telefone)`.
- RLS: operador só lê/escreve as próprias linhas (`auth.uid() = user_id`).
- GRANT canônico para `authenticated` + `service_role` (sem `anon`).
- Index em `(user_id)` (PK já cobre busca por telefone dentro do user).

Sem migração de dados: ausência de linha = nunca lido (tudo aparece como não lido na primeira passagem do operador).

## Escopo frontend

Arquivos tocados (lista mínima):

1. **`src/pages/eventos/EventosChatIA.tsx`**
   - Nova query `useQuery` em `whatsapp_conversa_leituras` filtrado por `user_id` atual → mapa `telefone → last_read_at`.
   - No agrupamento do `useMemo`, calcular `unread_count` por conversa (somente `direcao='entrada'` e `created_at > last_read_at`).
   - Ao chamar `handleSelectConversa`, disparar mutation `upsert` em `whatsapp_conversa_leituras` (`onConflict: 'user_id,telefone'`) com `last_read_at = now()` + invalidar a query de leituras.

2. **`src/components/eventos/n/ConversasList.tsx`**
   - Estender `ConversaAgrupada` com `unread_count: number`.
   - Adicionar toggle `Tabs`/`ToggleGroup` "Todas | Não lidos" + botão "Marcar todas como lidas".
   - Aplicar `font-bold` no nome, badge contador, e ordenar não-lidos primeiro quando o filtro estiver ativo.
   - Manter prioridade visual de "Cobrança" (já existe) acima do destaque de não-lido para não conflitar.

3. **Sem mexer** em `ChatPanel.tsx`, `ContatoDetalheDrawer.tsx` nem nas variantes `escopo='monitoramento'` — a marcação é única, vale para qualquer variante.

## Casos de borda

- **Tempo real**: o `INSERT` realtime invalida `chat-ia-conversas`; a contagem de não-lidos é derivada do resultado já com `last_read_at`, então recalcula sozinha.
- **Conversa aberta + nova mensagem chega**: como a UI mostra a conversa selecionada em primeiro plano, atualizamos o `last_read_at` também quando uma nova mensagem chega *enquanto a conversa está aberta* (efeito no `EventosChatIA` que observa `telefoneSelecionado` + `mensagens`).
- **Mensagens próprias (`direcao='saida'`) nunca contam como não-lidas.**
- **Sem usuário logado** (não deveria acontecer nessa tela, mas guard): query de leituras desabilitada → contagem 0 e filtro funciona apenas como "Todas".

## Fora do escopo

- Sincronizar com `read_at` do WhatsApp (read receipt do cliente) — é semântica diferente.
- Marcar individual mensagem como lida — só por conversa.
- Notificações push — fluxo separado.

## Validação manual

1. Abrir Relacionamento › Chat como operador A.
2. Em outra sessão, inserir mensagem `direcao='entrada'` para um telefone novo → conversa aparece em negrito com badge "1".
3. Clicar → badge some, negrito vira normal.
4. Filtrar "Não lidos" → conversa lida desaparece da lista; chega nova mensagem → reaparece.
5. Trocar de operador (B) → o estado é independente.

## Próximo passo

Aprove para eu rodar a migration e implementar os dois arquivos do front.
