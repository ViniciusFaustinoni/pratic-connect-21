

## Entendimento

Quando um técnico **conclui** uma tarefa (base ou rota), ela deve:

1. **Sumir do mapa de atribuições** (`/monitoramento/mapa`).
2. **Não contar** no tooltip/contador da base (se for base).
3. **Sumir do calendário** da base.
4. **Continuar visível apenas em Serviços de Campo** (`/monitoramento/vistorias-instalacoes-mon`) como histórico (já filtra por status).

Tarefas **em andamento** (`em_rota`, `em_andamento`) continuam visíveis no mapa/calendário — só some quando vira `concluida`/`finalizada`.

## Investigação necessária

1. `useVistoriasMapa` (`view_vistorias_mapa`) — confirmar se a view já filtra `status` ou traz tudo.
2. Hook que alimenta o tooltip/contador da base (provavelmente `useAgendamentosBase` ou similar).
3. `CalendarioBaseModal` / `CalendarioDiaModal` — qual hook usam.
4. Hook de instalações no mapa (`useInstalacoesMapa` ou similar).
5. Confirmar nomes exatos dos status finais (`concluida`, `finalizada`, `cancelada`?).

## Plano

### 1) Filtro de status na origem (mapa)

Adicionar filtro `.not('status', 'in', '(concluida,finalizada,cancelada)')` em:
- `useVistoriasMapa` (vistorias do mapa).
- Hook equivalente de instalações no mapa.
- Hook de retiradas/encaixes no mapa (se existirem).

Manter `agendada`, `confirmada`, `em_rota`, `em_andamento`, `pendente`.

### 2) Contador da base (tooltip)

Hook que alimenta o badge "X serviços" no ícone da base — aplicar mesmo filtro de status. Concluídas não entram na contagem.

### 3) Calendário da base

`CalendarioBaseModal` / `CalendarioDiaModal` — mesmo filtro. Concluídas somem da fila; em andamento permanecem.

### 4) Realtime

Quando status muda para `concluida`, o realtime já existente (`useServicosRealtime`, etc.) invalida as queries → o pino some automaticamente do mapa em tempo real.

### 5) Serviços de Campo (não muda)

`/monitoramento/vistorias-instalacoes-mon` já mostra todas (incluindo concluídas) com filtros próprios — funciona como histórico. **Sem alteração.**

### 6) Aba Atribuição Manual

A aba `Atribuição Manual` já filtra por serviços não atribuídos/pendentes — confirmar que concluídas não aparecem (provavelmente já não aparecem, mas validar).

## Arquivos prováveis

- `src/hooks/useVistoriasMapa.ts`
- `src/hooks/useInstalacoesMapa.ts` (ou similar)
- `src/hooks/useAgendamentosBase.ts` (ou similar)
- Hooks de calendário da base
- View `view_vistorias_mapa` no banco (talvez precise ajuste, talvez não)

## Resultado

- Mapa mostra apenas tarefas **ativas** (agendadas + em andamento).
- Tooltip da base conta só ativas.
- Calendário da base mostra só ativas.
- Serviços de Campo mantém histórico completo.
- Realtime: ao concluir, pino some na hora.

