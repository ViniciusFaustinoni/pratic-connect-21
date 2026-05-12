## Problema

Na troca de titularidade do veículo `KOU6D37` (Marcos Vinicius Dativo → Marcus Vinicius Faustinoni), o serviço `vistoria_entrada` foi gravado com `associado_id` do **titular antigo** (`6ab4887f`), mesmo a `solicitacao_troca_titularidade` já tendo `novo_associado_id` definido (`3f936bd7`) e a `vistoria` correspondente apontando para o novo titular.

Como **todo o fluxo de campo** (atribuição, mapa, confirmação, imprevisto, reagendamento, follow-up, WhatsApp) lê `servicos.associado_id` para descobrir nome e telefone do destinatário, o resultado é:

- WhatsApp de agendamento, confirmação, imprevisto e reagendamento foi enviado para o **titular antigo**.
- A tarefa aparece como pertencente ao titular antigo na fila e no mapa.

## Causa raiz

1. O serviço `vistoria_entrada` que cobre a troca foi criado/herdado com `associado_id` do contrato antigo, não do novo. Hoje **nenhuma camada normaliza isso** após `solicitacoes_troca_titularidade.novo_associado_id` ser preenchido.
2. As funções que disparam mensagens (`enviar-link-reagendamento`, `cron-reagendamento-automatico`, `cron-followup-reagendamento`, `enviar-confirmacao-manual`, `confirmar-vistorias-manha-cron`) **assumem** que `servicos.associado_id` já é o destinatário correto e não checam contexto de troca de titularidade.
3. O `cron-reagendamento-automatico` clona o serviço imprevisto preservando o `associado_id` errado, propagando a falha para o serviço reagendado.

## Plano

### 1. Garantir o `associado_id` correto em `servicos` de troca de titularidade

- Criar trigger `trg_servicos_troca_titularidade_normaliza_associado` em `servicos` (BEFORE INSERT/UPDATE) que, quando `cotacao_id` ou `vistoria_origem_id` apontar para uma `solicitacoes_troca_titularidade` com `novo_associado_id` definido (e ainda não `efetivada`), força:
  - `associado_id := novo_associado_id`
  - `contrato_id := contrato novo (cotacao_id da solicitação, status assinado/ativo/aguardando_instalacao)` quando nulo.
- Atualizar `fn_troca_pos_assinatura_pagamento` e o bloco equivalente em `contrato-gerar` para sempre gravar `associado_id = novo_associado_id` (já fazem, mas adicionar fallback explícito buscando `solicitacoes_troca_titularidade.novo_associado_id` por `cotacao_id`).
- Backfill SQL: para todo `servicos` com `vistoria_origem_id`/`cotacao_id` ligado a `solicitacoes_troca_titularidade` com `novo_associado_id` e `status` não-terminal, reescrever `associado_id` e `contrato_id` para os do novo titular. Inclui o caso atual (KOU6D37, serviços `2b58b302` e `7bc4f730`).

### 2. Endurecer todas as funções de notificação para resolver o destinatário pelo contexto

Nas funções abaixo, adicionar helper único que, dado um `servico`, retorna `{ associado_id, telefone, nome }` consultando primeiro `solicitacoes_troca_titularidade` (via `cotacao_id` ou `servico_vistoria_id`) quando aplicável e caindo em `servicos.associado_id` no caso geral:

- `supabase/functions/enviar-link-reagendamento/index.ts`
- `supabase/functions/cron-reagendamento-automatico/index.ts` (tanto na propagação de campos quanto no `INSERT` do novo `servicos`)
- `supabase/functions/cron-followup-reagendamento/index.ts`
- `supabase/functions/enviar-confirmacao-manual/index.ts`
- `supabase/functions/confirmar-vistorias-manha-cron/index.ts`

Com o item 1, esse fallback é um cinto-extra; sem ele, evita repetir o problema enquanto serviços antigos não migram.

### 3. Ajustes mínimos de UI

- `useTarefaAtual` / cards do mapa e da fila do técnico já leem `associado` por `servicos.associado_id`. Após o fix em (1) e o backfill, passam a mostrar o nome correto sem alteração de código.

### 4. Verificação

- Rodar query confirmando que, para a placa `KOU6D37`, todos os `servicos` ativos passam a apontar para `3f936bd7` (Marcus Vinicius Faustinoni).
- Disparar manualmente `enviar-link-reagendamento` para o serviço `7bc4f730` em ambiente de teste e validar que o destino é o telefone do novo titular.

## Detalhes técnicos

- Migration nova com:
  - função `fn_normalizar_associado_servico_troca()` + trigger BEFORE INSERT OR UPDATE em `servicos`.
  - UPDATE de backfill restrito a `solicitacoes_troca_titularidade` com `novo_associado_id IS NOT NULL` e `efetivada_em IS NULL`.
- Helper TS `resolveDestinatarioServico(servico)` em arquivo compartilhado de cada função (cada edge function tem seu próprio bundle, então duplicamos o helper inline — sem import cruzado entre funções).
- Nenhuma alteração em RLS, esquema de cotações ou no fluxo de pagamento.

## Arquivos afetados

- Migration nova (Supabase) — trigger + backfill.
- `supabase/functions/contrato-gerar/index.ts` — fallback `associado_id` por solicitação.
- `supabase/functions/enviar-link-reagendamento/index.ts`
- `supabase/functions/cron-reagendamento-automatico/index.ts`
- `supabase/functions/cron-followup-reagendamento/index.ts`
- `supabase/functions/enviar-confirmacao-manual/index.ts`
- `supabase/functions/confirmar-vistorias-manha-cron/index.ts`