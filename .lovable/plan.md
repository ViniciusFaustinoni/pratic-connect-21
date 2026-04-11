

## Plano: Enviar confirmação WhatsApp imediatamente ao agendar com encaixe

### Diagnóstico

O fluxo atual:
1. `agendar-vistoria-completa` — apenas salva os dados na cotação, sem enviar nenhuma mensagem
2. `criar-instalacao-pos-pagamento` — envia a confirmação de encaixe, mas só roda **após o pagamento**

O associado que habilita encaixe e prossegue **não recebe nenhuma mensagem** até o pagamento ser processado.

### Alteração

**`supabase/functions/agendar-vistoria-completa/index.ts`** — Adicionar envio de confirmação WhatsApp imediata quando `permiteEncaixe = true`.

Após salvar os dados na cotação (linha 145), e antes do return:

1. Buscar dados do lead/associado vinculado à cotação (nome e telefone) usando `cotacao.telefone1_solicitante` e `cotacao.nome_solicitante` (já disponíveis na query da linha 88)
2. Formatar a mensagem de confirmação com data, período e endereço
3. Invocar `whatsapp-send-text` com template `confirmacao_agendamento_v1`
4. NÃO criar registro em `confirmacoes_agendamento` aqui (ainda não há serviço/instalação — será feito no `criar-instalacao-pos-pagamento`)

O envio será feito em try/catch para não bloquear o fluxo se falhar.

### Deploy

Deploy de `agendar-vistoria-completa` após a alteração.

### Resultado
- O associado que habilitar encaixe receberá a confirmação WhatsApp imediatamente ao agendar
- O fluxo de pagamento não é afetado
- Se o envio falhar, o agendamento ainda é salvo normalmente

