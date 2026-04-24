## Diagnóstico

O bloqueio automático de horário de almoço para técnicos está implementado em **4 pontos** e roda hoje para todos os técnicos que **não** são "Base" (técnicos de rota são forçados a entrar em almoço após 4h trabalhadas; Base já é manual). A pedido, vamos remover esse comportamento automático para **todos os tipos de técnico** — ninguém mais será colocado em almoço pelo sistema, nem terá a tela bloqueada por overlay.

### Locais afetados

| # | Arquivo | O que faz hoje |
|---|---|---|
| 1 | `src/hooks/useJornadaTrabalho.ts` (l. 404-418) | useEffect inicia almoço automaticamente após 4h se `!isBase` |
| 2 | `src/hooks/useJornadaTrabalho.ts` (l. 448-458) | useEffect finaliza almoço automaticamente após 60min se `!isBase` |
| 3 | `src/hooks/useJornadaTrabalho.ts` (l. 429-444) | Rollback que tira do almoço se entrou com tarefa em execução (perde sentido sem auto-início) |
| 4 | `src/components/vistoriador/AlmocoBloqueioOverlay.tsx` (montado em `InstaladorLayout.tsx`) | Overlay tela cheia que aparece em `emAlmoco` |
| 5 | `supabase/functions/atribuir-proxima-tarefa/index.ts` (l. 314-361) | Força status `em_almoco` quando o técnico pede próxima tarefa após 4h |
| 6 | `supabase/functions/cron-atribuir-tarefas/index.ts` (l. 227-267) | Cron força `em_almoco` periodicamente após 4h |
| 7 | `supabase/functions/atribuir-proxima-tarefa/index.ts` (l. 285-311) | Auto-finaliza almoço expirado (>60min) — **manter** (apenas se ele tiver iniciado manualmente) |
| 8 | `supabase/functions/cron-atribuir-tarefas/index.ts` (l. 196-225) | Idem auto-finaliza expirado — **manter** |

## O que vai mudar

### 1. Remover início automático de almoço (frontend)
- `useJornadaTrabalho.ts`: deletar o `useEffect` das linhas 404-418 (forçar `iniciarAlmocoMutation` após 4h).
- Remover o `useEffect` de rollback (l. 429-444), pois ele só existia para corrigir o auto-início acidental.
- Manter `iniciarAlmocoMutation` exposta para uso manual via botão.
- Manter `almocoAdiado` como informativo? **Não** — perde sentido. Remover a flag e suas referências em `JornadaStatusBar.tsx`.

### 2. Remover auto-finalização de almoço (frontend)
- Deletar o `useEffect` linhas 448-458. Quem entrou em almoço (manualmente) sai por botão. O servidor ainda finaliza se passar muito tempo (resiliência), mas o cliente não força mais.

### 3. Remover overlay de bloqueio
- Desmontar `<AlmocoBloqueioOverlay />` do `InstaladorLayout.tsx` (linha 124).
- Marcar `AlmocoBloqueioOverlay.tsx` como deprecated/excluir o arquivo. Como ele só era usado nesse layout, vamos **excluir** o arquivo para evitar confusão futura.

### 4. Remover força de almoço nas Edge Functions
- `atribuir-proxima-tarefa/index.ts`: remover o bloco "Forçar almoço se atingiu limite configurado" (l. 314-361). A função continua respeitando `em_almoco` se o técnico tiver iniciado manualmente (l. 264-312 — manter), pulando atribuição enquanto não acabar.
- `cron-atribuir-tarefas/index.ts`: remover o bloco "Verificar se precisa forçar almoço" (l. 227-267). Idem manter o reconhecimento de almoço manual.
- **Manter** a auto-finalização do almoço expirado (>60min) nas duas funções — é uma rede de segurança caso o técnico esqueça de finalizar manualmente; sem isso ele ficaria preso em `em_almoco` para sempre. Apenas o **início** deixa de ser automático.

### 5. UI da `JornadaStatusBar.tsx`
- Hoje o botão "Iniciar almoço" aparece só para Base (`isBase && !inicio_almoco`). Vamos liberar para **todos os técnicos** (rota e base) sempre que o turno estiver `ativo` e ainda não houver almoço iniciado.
- Remover o aviso "Almoço adiado por tarefa em execução" (sem sentido sem auto-início).

## O que NÃO muda

- Banco de horas, jornada de 8h, atraso e acréscimo seguem funcionando normalmente quando o técnico decide tirar o almoço.
- Configurações em `configuracoes` (`jornada_horas_ate_almoco`, `jornada_duracao_almoco_minutos`) continuam existindo — passam a ser apenas referência (ex.: tempo do contador na UI). Sem auto-trigger.
- O servidor continua **respeitando** o status `em_almoco` quando o técnico inicia manualmente (não atribui tarefa, mostra contador).
- Telas de RH/monitoramento que reportam tempo de almoço/atraso seguem inalteradas.

## Resultado esperado

- Nenhum técnico (rota, base, instalador, vistoriador) é colocado em almoço pelo sistema.
- Nenhum overlay tela cheia aparece.
- O técnico tira almoço quando quiser, pelo botão "Iniciar almoço" → "Finalizar almoço".
- Se ele esquecer de finalizar, o servidor finaliza após 60min (rede de segurança); o atraso continua sendo computado.

## Atualização de memória

Atualizar `mem://logic/operations/technician-lunch-cycle-automation` para refletir que **não há mais início automático de almoço** — apenas finalização defensiva no servidor caso o técnico esqueça.
