

# Novo fluxo de confirmação: véspera 18h + manhã 08h

## Situação atual
- Existem duas edge functions (`confirmar-vistorias-manha-cron` e `confirmar-agendamento-cron`) mas **nenhuma está agendada** no pg_cron
- O template `confirmacao_agendamento_v1` existe mas está com status `PENDING` (não aprovado pela Meta)
- O fluxo antigo disparava às 7h do dia, mas nunca funcionou por falta de cron job

## Nova lógica

| Disparo | Horário | Quem recebe | Template |
|---|---|---|---|
| Véspera | 18h00 (dia anterior) | Todos com serviço amanhã e `confirmacao_whatsapp IS NULL` | `confirmacao_vespera_v1` |
| Manhã | 08h00 (dia do serviço) | Apenas quem NÃO confirmou ainda (`confirmacao_whatsapp = 'aguardando_confirmacao_vespera'`) | `confirmacao_manha_v1` |

## Alterações

### 1. Criar template `confirmacao_vespera_v1` na tabela `whatsapp_meta_templates`

Inserir rascunho com corpo:
```
Olá {{1}}! Lembramos que seu(sua) {{2}} está agendado(a) para amanhã, {{3}}. Responda SIM para confirmar ou solicite reagendamento. Equipe PRATIC.
```
Categoria UTILITY, status DRAFT, pronto para envio à Meta.

### 2. Criar template `confirmacao_manha_v1` na tabela `whatsapp_meta_templates`

Inserir rascunho com corpo:
```
Bom dia, {{1}}! Seu(sua) {{2}} é HOJE, {{3}}. Precisamos da sua confirmação para enviar o técnico. Responda SIM para confirmar ou solicite reagendamento. Equipe PRATIC.
```
Categoria UTILITY, status DRAFT, pronto para envio à Meta.

### 3. Reescrever `confirmar-vistorias-manha-cron/index.ts` — Disparo duplo (véspera + manhã)

A edge function passa a receber um parâmetro `tipo_disparo` (`vespera` ou `manha`) ou detectar automaticamente pela hora:
- **Se hora entre 17-19 (véspera)**: busca serviços de AMANHÃ com `confirmacao_whatsapp IS NULL`, envia template `confirmacao_vespera_v1`, marca `confirmacao_whatsapp = 'aguardando_confirmacao_vespera'`
- **Se hora entre 7-9 (manhã)**: busca serviços de HOJE com `confirmacao_whatsapp = 'aguardando_confirmacao_vespera'` (não confirmou na véspera), envia `confirmacao_manha_v1`, marca `confirmacao_whatsapp = 'aguardando_confirmacao_manha'`

### 4. Agendar 2 cron jobs no pg_cron

Via SQL insert (não migração):
- `0 21 * * *` (21h UTC = 18h Brasília): chama `confirmar-vistorias-manha-cron`
- `0 11 * * *` (11h UTC = 08h Brasília): chama `confirmar-vistorias-manha-cron`

### 5. Remover `confirmar-agendamento-cron` (duplicado)

A function antiga que buscava 1h à frente é redundante com o novo fluxo. Remover e garantir que não há cron apontando para ela.

### 6. Atualizar `whatsapp-webhook/index.ts` — Reconhecer status `aguardando_confirmacao_vespera`

No trecho que processa respostas "SIM", adicionar `aguardando_confirmacao_vespera` à lista de status válidos para confirmação pendente.

### 7. Atualizar `cron-expirar-confirmacoes/index.ts`

Adicionar `aguardando_confirmacao_vespera` ao filtro `.in('status', [...])` para que confirmações da véspera não respondidas também expirem.

## Resultado

- 18h: todos os agendamentos de amanhã recebem lembrete
- 08h: quem não respondeu recebe segunda chance
- Quem confirma na véspera não recebe mensagem de manhã
- Templates ficam disponíveis na área de templates para envio à Meta

