# Tela de Transbordos em Relacionamento

## Objetivo

Criar nova tela `/relacionamento/transbordos` (item no sidebar de Relacionamento) listando todos os transbordos ativos (atendimentos que a IA transferiu para humano), com clique abrindo a conversa no chat existente e botão **Concluir** que finaliza o atendimento e zera o contexto da IA para a próxima interação.

## Arquitetura

Reutiliza a infra já criada (`whatsapp_ia_pausas` + `agente_consultor_contatos.status='atendimento_humano'`). Adiciona:

1. **Sidebar** — novo item `Transbordo` em Relacionamento.
2. **Rota + página** `/relacionamento/transbordos` → `TransbordosRelacionamento.tsx`.
3. **Botão Concluir** no header do chat (`EventosChatIA`), visível só quando a conversa selecionada está em transbordo.
4. **Corte de contexto da IA** — nova coluna `contexto_cortado_em` em `whatsapp_ia_pausas` (ou tabela paralela leve). O `getConversationHistory` do `whatsapp-webhook` passa a respeitar esse floor (`Math.max(janela24h, contexto_cortado_em)`), garantindo que a próxima conversa começa do zero.

## Tela `/relacionamento/transbordos`

Lista (tabela / cards) das linhas de `whatsapp_ia_pausas` com `pausada_ate > now()`, enriquecida com:

- Nome do associado (join via `associados.telefone/whatsapp` por dígitos normalizados; fallback "Número desconhecido" + telefone).
- Avatar.
- Motivo (`transbordo_boleto` → "Boleto vencido"; `intervencao_humana` → "Intervenção humana"; `transbordo_humano` → "Solicitação do associado").
- Início (`created_at`) e tempo aguardando.
- Última mensagem (preview) — opcional, busca leve em `whatsapp_mensagens`.
- Ação: linha clicável → navega para `/eventos/chat-ia?telefone=<tel>` (parametrizar seleção inicial no `EventosChatIA`).

Filtros simples: busca por nome/telefone + filtro por motivo. Realtime via `refetchInterval` 15s (mesmo padrão do `transbordoMap` existente).

## Botão "Concluir atendimento"

Renderizado no header da conversa ativa em `EventosChatIA` quando o telefone selecionado tem transbordo. Ao clicar:

1. `UPDATE whatsapp_ia_pausas SET pausada_ate = now(), contexto_cortado_em = now(), motivo = 'encerrado_humano' WHERE telefone = ...` (efetivamente expira a pausa e marca corte).
2. `UPDATE agente_consultor_contatos SET status = 'ativo' WHERE telefone = ...` (devolve o controle pra IA).
3. Invalida queries `chat-ia-transbordo-ativo` e a lista de transbordos.
4. Toast "Atendimento concluído".

## Corte de contexto da IA

Adicionar `contexto_cortado_em timestamptz NULL` em `whatsapp_ia_pausas` (linha já é por telefone — PK ideal pra isso). O `getConversationHistory` em `whatsapp-webhook/index.ts` faz uma leitura prévia da pausa por telefone e usa:

```ts
const corte = pausa?.contexto_cortado_em ? new Date(pausa.contexto_cortado_em) : null;
const janelaAtras = new Date(Math.max(Date.now() - 24*3600*1000, corte?.getTime() ?? 0)).toISOString();
```

Assim, qualquer mensagem trocada antes do "Concluir" some do contexto enviado ao Gemini — a próxima interação do associado nasce limpa.

## Mudanças técnicas (resumo)

- **Migration:** `ALTER TABLE public.whatsapp_ia_pausas ADD COLUMN contexto_cortado_em timestamptz NULL;`
- **Sidebar:** novo item em `AppSidebar.tsx` (Relacionamento).
- **Rota:** `App.tsx` registra `<Route path="/relacionamento/transbordos" element={<TransbordosRelacionamento />} />`.
- **Nova página:** `src/pages/relacionamento/TransbordosRelacionamento.tsx`.
- **Hook:** `src/hooks/useTransbordosAtivos.ts` (lista enriquecida + mutation `concluirTransbordo`).
- **Edit `EventosChatIA.tsx`:**
  - Aceitar `?telefone=` na URL e selecionar a conversa automaticamente.
  - Renderizar botão "Concluir atendimento" no header quando há transbordo ativo no telefone selecionado.
- **Edit `whatsapp-webhook/index.ts`:** `getConversationHistory` respeita `contexto_cortado_em`.

## Fora de escopo

- Não cria histórico de transbordos concluídos (lista mostra só ativos). Se quiser histórico depois, adicionamos tab "Concluídos" buscando pausas expiradas com `motivo='encerrado_humano'`.
- Não muda o comportamento de pausa por intervenção manual (10 min) já existente.
- Sem permissões/roles novas — segue as do módulo Relacionamento.