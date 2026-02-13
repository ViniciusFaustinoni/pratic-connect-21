
# Corrigir erro "net.http_post does not exist" ao solicitar documentos

## Problema

Ao clicar em "Solicitar Documentos", o sistema atualiza o status do sinistro para `documentacao_pendente`. Isso dispara um trigger no banco de dados (`on_sinistro_status_change`) que tenta chamar `net.http_post()` para invocar a edge function `notificar-sinistro`. Porem, a extensao `pg_net` nao esta habilitada no banco, causando o erro:

```
function net.http_post(url => unknown, headers => jsonb, body => text) does not exist
```

O trigger foi criado na migracao `20260103190153` e tenta notificar via HTTP toda vez que o status do sinistro muda.

## Solucao

Remover o trigger `on_sinistro_status_change` e a funcao `fn_sinistro_status_change`, pois a notificacao via WhatsApp ja e feita diretamente pelo frontend (o `SolicitarDocumentosSinistroDialog` ja chama a edge function `whatsapp-send-text`). O trigger e redundante e causa o erro.

## Alteracao

| Tipo | Descricao |
|---|---|
| Migracao SQL | `DROP TRIGGER IF EXISTS on_sinistro_status_change ON public.sinistros;` e `DROP FUNCTION IF EXISTS fn_sinistro_status_change();` |

Nenhuma alteracao de codigo e necessaria - o dialog ja envia a notificacao WhatsApp corretamente. Apenas o trigger do banco precisa ser removido.

## Detalhes tecnicos

A migracao SQL tera apenas:

```sql
DROP TRIGGER IF EXISTS on_sinistro_status_change ON public.sinistros;
DROP FUNCTION IF EXISTS fn_sinistro_status_change();
```

Isso remove a dependencia de `pg_net` sem perder funcionalidade, ja que todas as notificacoes sao enviadas pelo codigo do frontend via edge functions.
