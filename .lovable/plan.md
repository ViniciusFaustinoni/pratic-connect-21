
## Diagnóstico

- Revisei o fluxo de atribuição, os logs das edge functions e o estado atual do banco.
- O problema **não está no payload de atribuição**: existe profissional com `em_servico = true` e GPS recente.
- O caso do Marcus mostra a causa com clareza:
  - instalação `ba5aecdd...` e serviço `b232b3ca...` foram criados às **18:47**
  - às **19:00** ambos já estavam com status **`nao_compareceu`**
  - depois disso, o `cron-atribuir-tarefas` passou a logar **“1 profissional em serviço”** e **“Nenhum serviço disponível”**
- Ou seja: o serviço **não ficou pendente por falha de atribuição**; ele foi **retirado do conjunto elegível antes de poder ser atribuído**.

## Causa raiz

A causa raiz está na **Parte 2** de `supabase/functions/cron-reagendamento-automatico/index.ts`.

Hoje ela pega **qualquer serviço de hoje com `status = agendada`** e marca como `nao_compareceu`, sem validar:
- idade mínima do registro;
- se a janela do atendimento realmente venceu;
- se o serviço acabou de ser criado;
- se ainda existe chance real de atribuição.

Como `cron-atribuir-tarefas` e `atribuir-proxima-tarefa` só consideram `status in ('pendente', 'agendada')`, esse serviço some da atribuição automática e manual.

Em resumo: existe uma **corrida entre “reagendar” e “atribuir”**, e o cron de reagendamento está atuando cedo demais.

## Correção completa

### 1. Corrigir o gatilho do reagendamento automático
Arquivo: `supabase/functions/cron-reagendamento-automatico/index.ts`

Ajustar a Parte 2 para só marcar `nao_compareceu` quando o serviço estiver realmente vencido, com regras seguras:

- exigir **idade mínima** do serviço;
- se houver `hora_agendada`, só processar **após essa hora + tolerância**;
- se não houver hora, usar o **fim do período** (`manha` / `tarde` / `noite`);
- se não houver nem hora nem período, usar um **cutoff conservador** no fim do dia, nunca minutos após a criação.

Também adicionar logs separados para:
- serviços ignorados por serem recentes;
- serviços ignorados por ainda estarem dentro da janela;
- serviços efetivamente reagendados.

### 2. Restaurar o caso já afetado
Criar migration de correção de dados para:

- restaurar `servicos.b232b3ca...` para `status = 'agendada'`;
- limpar `reagendamento_enviado_em` desse serviço, se preenchido;
- restaurar `instalacoes.ba5aecdd...` para `status = 'agendada'`.

Assim o serviço volta a ficar elegível para atribuição.

### 3. Melhorar observabilidade do motor de atribuição
Arquivos:
- `supabase/functions/cron-atribuir-tarefas/index.ts`
- `supabase/functions/atribuir-proxima-tarefa/index.ts`

Sem mudar a regra principal de atribuição, adicionar logs de exclusão por motivo:
- status fora da janela;
- confirmação WhatsApp;
- `local_vistoria = base`;
- falta de coordenadas;
- bloqueio por horário.

Isso evita novos “sumiços silenciosos” e acelera troubleshooting futuro.

## Arquivos afetados

- `supabase/functions/cron-reagendamento-automatico/index.ts`
- nova migration SQL de reparo de dados
- opcional de hardening:
  - `supabase/functions/cron-atribuir-tarefas/index.ts`
  - `supabase/functions/atribuir-proxima-tarefa/index.ts`

## Resultado esperado

- instalações recém-criadas não serão mais marcadas como `nao_compareceu` minutos depois;
- quando houver técnico online, o serviço continuará elegível para o motor de atribuição;
- o reagendamento automático só atuará quando o atendimento realmente tiver expirado;
- o fluxo de campo volta a ficar funcional e fluido.
