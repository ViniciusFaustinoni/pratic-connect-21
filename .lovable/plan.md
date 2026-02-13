
# Corrigir sinistro aprovado que não sai do dashboard de eventos

## Problema

O sinistro foi criado com sucesso (SIN-20260213-0003 existe no banco com status "comunicado"), mas a solicitacao na tabela `chat_solicitacoes_ia` continua com status `pendente`. Por isso o banner "1 sinistro(s) aguardando aprovacao via IA" continua aparecendo.

## Causa raiz

Na edge function `aprovar-solicitacao-ia`, linha 414, o campo `aprovador_id` recebe o `userId` (que e o `auth.users.id`). Porem, a coluna `aprovador_id` tem uma foreign key para `profiles(id)`, que e um UUID diferente do `auth.users.id`.

Isso faz o UPDATE falhar silenciosamente (constraint violation), e a solicitacao nunca sai do status `pendente`.

## Solucao

### 1. Corrigir a edge function para buscar o `profiles.id` correto

**Arquivo**: `supabase/functions/aprovar-solicitacao-ia/index.ts`

Antes de usar `aprovador_id`, buscar o profile do usuario:

```
const { data: perfil } = await supabaseAdmin
  .from('profiles')
  .select('id')
  .eq('user_id', userId)
  .single();

const perfilId = perfil?.id || null;
```

Usar `perfilId` em vez de `userId` em todas as ocorrencias de `aprovador_id` (linhas 107 e 414).

### 2. Corrigir dado inconsistente existente

A solicitacao `285d937b-9487-4d86-bee6-406ec34a1817` precisa ser atualizada para `aprovado` manualmente, ja que o sinistro ja foi criado. Isso sera feito diretamente na edge function com a correcao.

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/aprovar-solicitacao-ia/index.ts` | Buscar `profiles.id` via `user_id` e usar como `aprovador_id` |

## Dado inconsistente

Apos o deploy, sera necessario corrigir a solicitacao existente. Posso atualizar o status para "aprovado" diretamente no banco apos a correcao.
