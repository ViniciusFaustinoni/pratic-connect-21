

## Remover envio duplicado de mensagem de boas-vindas

### Problema

Quando o instalador finaliza a instalação, o código em `src/hooks/useServicos.ts` (linha ~1159) chama `notificar-cliente` com tipo `instalacao_concluida`, que usa o template `cadastro_aprovado_botao` — o mesmo template de boas-vindas. Depois, quando o analista de cadastro aprova, a edge function `ativar-associado` envia novamente o `cadastro_aprovado_botao`. Resultado: mensagem duplicada.

### Solução

Remover o envio da notificação WhatsApp `instalacao_concluida` no `useServicos.ts`. O histórico e a notificação in-app podem permanecer — apenas o disparo para `notificar-cliente` com tipo `instalacao_concluida` deve ser removido.

A mensagem de boas-vindas continuará sendo enviada apenas pelo fluxo de aprovação do analista (`ativar-associado`).

### Alteração

**`src/hooks/useServicos.ts`** — Remover o bloco fire-and-forget (linhas ~1156-1170) que invoca `notificar-cliente` com `instalacao_concluida`.

