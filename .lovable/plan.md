## Regra
Durante a contratação, se o associado chegar na etapa de agendamento **após as 16:00** (hora local), a opção de **D+1 (dia seguinte)** não pode ser exibida. Apenas D+2 em diante deve aparecer (respeitando domingos, sábados quando aplicável e datas bloqueadas).

Isso vale tanto para o agendamento "no endereço" (atendimento volante na própria contratação) quanto para o agendamento "ir até a base", para manter consistência ao longo do fluxo.

## Onde alterar

1. `src/components/cotacao-publica/AgendamentoVistoria.tsx` (≈ linhas 96–118)
   - Hoje: gera `hoje` (se ainda houver período) + começa o loop em `addDays(hoje, 1)` até preencher 3 datas.
   - Mudança: calcular `puloDiaSeguinte = agora.getHours() >= 16`. Se verdadeiro, iniciar o loop em `addDays(hoje, 2)` em vez de `addDays(hoje, 1)`. Hoje continua sendo descartado pela lógica existente (não há mais períodos disponíveis após 16h, então naturalmente já não aparece — mas a regra do ≥16h tem precedência explícita para descartar D+1).

2. `src/components/cotacao-publica/AgendamentoBase.tsx` (≈ linhas 67–80)
   - Hoje: `let currentDate = addDays(new Date(), weekOffset * 7);`
   - Mudança: quando `weekOffset === 0` e `agora.getHours() >= 16`, iniciar com `addDays(new Date(), 2)`. Em outros offsets de semana, manter comportamento atual.
   - Observação: hoje (D+0) já é filtrado pela função `periodoExpirado` quando todos os períodos passaram, portanto nada muda para D+0.

## Detalhes técnicos
- Threshold: `new Date().getHours() >= 16`.
- Sem nova dependência. Usa `addDays` já importado de `date-fns`.
- Não altera schema, não altera edge functions, não altera RLS.
- Mantém checagens existentes (`isDomingo`, `datasBloqueadasSet`, `getPeriodosDisponivelsPorHora`).

## Fora do escopo
- `AgendamentoSubstituicao.tsx` e `StepVistoria.tsx` (substituição) — não fazem parte do fluxo de contratação inicial. Posso aplicar a mesma regra lá se você confirmar.