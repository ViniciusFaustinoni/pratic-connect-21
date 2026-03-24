


# Gatilho de prazo expirado para confirmação de vistoria/instalação — IMPLEMENTADO ✅

## Resumo

Nova edge function `cron-expirar-confirmacoes` que verifica confirmações pendentes e cancela automaticamente agendamentos não respondidos dentro do prazo configurável.

## Implementação

- **Edge function** `cron-expirar-confirmacoes` criada e deployada
- **Configuração** `prazo_confirmacao_agendamento_horas` (padrão: 4h) adicionada à tabela `configuracoes`
- **UI** Campo "Prazo para confirmação (horas)" adicionado na aba Instalação e Rotas
- **Filtros** `cron-atribuir-tarefas` já exclui serviços expirados (filtro `.or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada')`)
