

# Limpar Historico de Conversa da IA ao Excluir Sinistro

## Problema

Quando um sinistro e excluido pelo diretor, o contexto da IA (dados do banco) corretamente mostra "Nenhum sinistro em aberto". Porem, o **historico de conversa** (`chat_mensagens_ia`) ainda contem mensagens referenciando o sinistro excluido (ex: "ja abrimos o protocolo SIN-20260216-0004").

A IA le esse historico e "lembra" do sinistro mesmo apos a exclusao, causando o comportamento reportado.

## Causa Raiz

- **WhatsApp** (`whatsapp-webhook`): Carrega as ultimas 2h de `chat_mensagens_ia` (linha 1791) como contexto de conversa
- **App** (`assistente-chat`): Recebe `conversationHistory` do frontend (linha 1142)
- Em ambos os casos, mensagens antigas mencionando o sinistro fazem a IA acreditar que ele ainda existe

## Solucao

### 1. Limpar `chat_mensagens_ia` ao excluir sinistro

**Arquivo:** `supabase/functions/delete-sinistro/index.ts`

Adicionar um passo na exclusao em cascata para deletar as mensagens de chat da IA do associado. Isso forca a IA a "esquecer" o contexto anterior.

O DELETE sera feito por `associado_id` para limpar todo o historico recente, garantindo que nenhuma referencia ao sinistro excluido sobreviva.

### 2. Limpar `chat_mensagens_ia` ao excluir chamado de assistencia

**Arquivo:** `supabase/functions/delete-chamado-assistencia/index.ts` (se existir)

Mesma logica: ao excluir um chamado de assistencia, limpar o historico de conversa do associado.

### 3. Limpar historico no frontend (App)

**Arquivo relacionado no frontend** (componente do chat do associado)

Quando a conversa do App envia `conversationHistory`, esses dados vem do estado local (React). O problema principal e o WhatsApp (que busca do banco), mas o App tambem pode manter historico em memoria. Nao e necessario alterar o frontend pois a proxima sessao do App vai iniciar sem historico antigo.

## Detalhe Tecnico

No `delete-sinistro/index.ts`, antes de excluir o sinistro principal (passo 9), adicionar:

```text
// Limpar historico de conversa da IA do associado
// para que a IA "esqueca" referencias ao sinistro excluido
await supabaseAdmin
  .from("chat_mensagens_ia")
  .delete()
  .eq("associado_id", sinistro.associado_id);
```

O mesmo sera feito no `delete-chamado-assistencia` se existir, usando o `associado_id` do chamado.

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/delete-sinistro/index.ts` | Adicionar limpeza de `chat_mensagens_ia` por `associado_id` na exclusao em cascata |
| `supabase/functions/delete-chamado-assistencia/index.ts` | Mesma limpeza (se o arquivo existir) |

Nenhuma migration necessaria.

