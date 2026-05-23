## Contexto

No modal `ModalDetalhesSubstituicao` (acessado na fila Substituição em `/vendas/cotacoes`), quando o status é `aguardando_termo`, o card "Termo de Cancelamento do veículo …" exibe hoje o botão **"Enviar Termo de Cancelamento"**. Esse botão dispara a edge `enviar-termo-cancelamento-substituicao`, criando um termo de cancelamento separado.

Isso ficou obsoleto: a substituição passou a usar um **único termo unificado** (template já configurado em `templates_contrato.is_default_substituicao=true`). Esse termo já é injetado automaticamente pelo `autentique-create-by-token` quando o cliente abre o link público de uma cotação com `tipo_entrada='substituicao_placa'`.

Portanto, o passo "enviar termo de cancelamento" não deve mais existir nesse fluxo. O caminho canônico é: **criar a cotação de substituição → cliente abre o link público → assina o termo unificado de substituição**.

## Objetivo

Trocar o comportamento do botão principal do card quando `status === 'aguardando_termo'` para que, em vez de enviar um termo de cancelamento separado, ele crie a cotação de substituição (aproveitando nome/email/telefone do associado) e leve o operador ao cotador para finalizar e gerar o link público.

## Mudanças

### 1. `src/components/substituicao/ModalDetalhesSubstituicao.tsx`

- No bloco `status === 'aguardando_termo'`: substituir o botão "Enviar Termo de Cancelamento" por um botão **"Criar Cotação de Substituição"** que chama o `handleCriarCotacao` já existente (navega para `/vendas/cotador` com `tipo_entrada=substituicao`, `associado_id`, `veiculo_antigo_id/placa/modelo`, `solicitacao_substituicao_id`).
- Atualizar o título do card de "Termo de Cancelamento do veículo …" para algo coerente, ex: **"Nova Cotação de Substituição"**, com uma linha curta explicando que o termo de substituição unificado será assinado pelo cliente dentro do link público da cotação.
- Remover (no modal) o uso visual de `useEnviarTermoCancelamentoSubstituicao` e do polling `useSyncTermoCancelamento` quando o fluxo nasce já como cotação. Manter os blocos `termo_enviado` / `termo_assinado` apenas como **visualização legada** (read-only) para solicitações antigas que já foram enviadas pelo fluxo anterior — sem botão de reenvio/verificação — para não quebrar registros em andamento.
- Manter o bloco "Nova Cotação para o veículo substituto" (status `termo_assinado` / `cotacao_criada`) intacto.

### 2. Status flow

Quando o operador clicar em "Criar Cotação de Substituição" no estado `aguardando_termo`, o caminho continua sendo finalizar a cotação no cotador. O `solicitacoes_substituicao_placa.status` pode permanecer `aguardando_termo` até a cotação ser vinculada (não muda nada no backend nesta entrega — apenas o rótulo na UI pode mostrar "Aguardando criação da cotação" se quisermos clareza, mas sem migração).

### Fora de escopo (não tocar agora)

- Edge `enviar-termo-cancelamento-substituicao` permanece no projeto como fallback para registros legados, mas deixa de ser chamada pelo modal.
- Não cria edge nova nem altera schema.
- Solicitações já em `termo_enviado` (cenários em andamento hoje) continuam visíveis em modo somente-leitura.

## Validação

1. Abrir uma solicitação de substituição em `aguardando_termo` (placa KOU6D37) → modal mostra "Criar Cotação de Substituição" no lugar do antigo botão de termo.
2. Clicar → navega para `/vendas/cotador?tipo_entrada=substituicao&associado_id=…&veiculo_antigo_id=…&solicitacao_substituicao_id=…`.
3. Finalizar a cotação no cotador → link público gerado normalmente → cliente abre o link → `autentique-create-by-token` detecta `tipo_entrada='substituicao_placa'` e usa o template `is_default_substituicao` (termo unificado).
4. Solicitações antigas em `termo_enviado` continuam aparecendo no modal sem o botão de envio, apenas mostrando o status.

## Memória a atualizar (após aplicar)

Adicionar nota em `mem://logic/operations/` registrando que "substituição usa termo unificado no link público; modal não envia mais termo de cancelamento separado".