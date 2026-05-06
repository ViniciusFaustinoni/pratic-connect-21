## Objetivo

Adicionar um item **"Chat"** no menu **Eventos** com as **mesmas funcionalidades** do chat de Relacionamento (lista de conversas, painel de mensagens, encerramento, pausa de IA, etc.), porém com um **painel lateral "Detalhes do contato" diferente**, contextualizado para o setor de Eventos.

A regra de memória do projeto exige: nunca duplicar funcionalidade já implementada — vamos **reaproveitar** todos os componentes existentes do chat e apenas trocar o drawer do contato.

---

## O que já existe (reuso)

- `pages/eventos/EventosChatIA.tsx` — página do chat (Relacionamento)
- `components/eventos/chat-ia/ChatPanel.tsx` — painel de mensagens
- `components/eventos/chat-ia/ConversasList.tsx` — lista de conversas
- `components/eventos/chat-ia/ContatoDetalheDrawer.tsx` — drawer atual (foco: ficha geral do associado)
- `useRastreadorPosicao` (hook) e `MapaRastreador` (componente) — posição atual
- `useVeiculoDetalhes` + `VeiculoDetalhesModal` — detalhes/fotos do veículo
- `NovoSinistroModal` — abrir evento (sinistro)
- `NovoChamadoModal` — abrir chamado de assistência 24h
- Tabela `sinistros` (eventos) e `chamados_assistencia` para listar histórico do associado

---

## Mudanças

### 1. Refatorar `EventosChatIA` para aceitar variante de drawer

Tornar a página parametrizável quanto a **qual drawer** renderizar como painel de detalhes do contato, mantendo 100% do restante (lista, mensagens, ações).

```text
EventosChatIA
 ├─ ConversasList            (igual)
 ├─ ChatPanel                (igual)
 └─ <DrawerComponent />      ← injetado por prop, default = ContatoDetalheDrawer (Relacionamento)
```

### 2. Criar `ContatoDetalheEventosDrawer`

Novo arquivo em `src/components/eventos/chat-ia/ContatoDetalheEventosDrawer.tsx`. Mesma interface de props do drawer atual (`telefone`, `open`, `onOpenChange`, `nomeContato`, `avatarUrl`) e mesma estrutura visual (Sheet lateral, cabeçalho com avatar/nome/telefone/badge, bloco de "IA pausada", bloco "Encerrar atendimento" idêntico). O que muda é o **miolo de informações** entre o cabeçalho e o encerrar.

Conteúdo do miolo (apenas se um associado for encontrado pelo telefone):

1. **Resumo do associado** — nome, status, e-mail.
2. **Veículos do associado** — lista com card por veículo:
   - Foto principal do veículo (quando houver).
   - Placa, marca/modelo, ano, cor.
   - Status do rastreador (online/offline) + última posição (lat/long + endereço se reverso disponível) via `useRastreadorPosicao`.
   - Botão **"Ver detalhes do veículo"** → abre o `VeiculoDetalhesModal` existente (modal sobre o drawer, na mesma tela).
   - Botão **"Ver no mapa"** → expande mini-mapa inline usando `MapaRastreador`.
3. **Eventos do associado** — lista resumida dos últimos sinistros (`sinistros` filtrados por `associado_id`), com data, tipo, status. Botão "Abrir" leva ao detalhe do sinistro em nova aba (mantém o chat aberto).
4. **Ações**:
   - Botão primário **"Abrir evento"** → abre `NovoSinistroModal` já pré-selecionando o associado e, se houver apenas 1 veículo, pré-selecionando-o.
   - Botão **"Abrir chamado de assistência"** → abre `NovoChamadoModal` pré-preenchido.

Caso o telefone **não** corresponda a nenhum associado: mostrar mensagem "Nenhum associado vinculado" e desabilitar as ações que dependem de `associado_id`.

### 3. Criar página `EventosChat` (rota nova)

Arquivo `src/pages/eventos/EventosChat.tsx` que apenas renderiza `<EventosChatIA drawerVariant="eventos" />` (ou similar). Sem lógica nova.

### 4. Rota e menu

- `src/App.tsx` — adicionar `<Route path="/eventos/chat" element={<EventosChat />} />` (lazy).
- `src/components/layout/AppSidebar.tsx` — adicionar item `{ title: 'Chat', url: '/eventos/chat', icon: MessageCircle }` na seção `eventos`, logo após "Dashboard".

### 5. Sem mudanças em banco

Toda a informação necessária já está nas tabelas existentes (`associados`, `veiculos`, `rastreadores`, `sinistros`, `chamados_assistencia`). Nenhuma migration.

---

## Arquivos tocados

- **Novo** `src/pages/eventos/EventosChat.tsx`
- **Novo** `src/components/eventos/chat-ia/ContatoDetalheEventosDrawer.tsx`
- **Edit** `src/pages/eventos/EventosChatIA.tsx` — aceitar prop `drawerVariant?: 'relacionamento' | 'eventos'` (default `'relacionamento'`) e escolher o drawer.
- **Edit** `src/App.tsx` — registrar a nova rota `/eventos/chat`.
- **Edit** `src/components/layout/AppSidebar.tsx` — adicionar item "Chat" no menu Eventos.

---

## Pontos de atenção

- **Não alterar** o chat de Relacionamento — o drawer atual continua sendo o default.
- **Reuso obrigatório** dos modais `NovoSinistroModal`, `NovoChamadoModal`, `VeiculoDetalhesModal` e do `MapaRastreador` — se durante a implementação descobrirmos qualquer divergência de assinatura, eu paro e pergunto antes de criar variantes.
- Ações sensíveis (abrir evento/chamado) **não** alteram nada por trás dos panos — apenas abrem os modais existentes; a criação real continua passando pelos fluxos canônicos já validados.
- Performance: queries de veículos/rastreadores/eventos terão `staleTime` adequado e `enabled` apenas quando o drawer estiver aberto e o associado resolvido (mesma estratégia das auditorias anteriores).
