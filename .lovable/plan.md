

## Bug confirmado

Reagendamento salvou corretamente no banco (`data_agendada = 2026-04-18`), mas o frontend exibe **17/04/2026** no popup do mapa e nos cards de tarefa. Clássico bug de timezone: `new Date("2026-04-18")` é interpretado como UTC midnight, e em fuso UTC-3 (Brasília) vira `2026-04-17 21:00`.

## Investigação

O projeto já tem o helper correto em `src/lib/date-utils.ts`:
- `parseDataLocal("2026-04-18")` → Date local sem shift de TZ
- `formatDataAgendada("2026-04-18")` → `"18/04/2026"`

O bug ocorre nos lugares onde a data DATE pura do Postgres (`data_agendada`) é formatada com `new Date(...)` direto, `format(new Date(data), ...)` do date-fns, ou `.toLocaleDateString()` sem parser local.

Preciso varrer os componentes do mapa de monitoramento e popups/cards de tarefa para localizar todas as ocorrências e trocar por `parseDataLocal` / `formatDataAgendada`.

## Suspeitos prováveis

- `src/components/mapa/*` — popups, tooltips, cards de tarefa
- `src/components/monitoramento/*` — listas e calendário
- `src/pages/monitoramento/*` — telas do mapa e calendário
- Qualquer `format(new Date(servico.data_agendada), "dd/MM/yyyy")` ou `new Date(data).toLocaleDateString()`

## Plano

### 1) Mapear ocorrências
`grep` por padrões problemáticos em componentes de exibição:
- `new Date(.*data_agendada`
- `format(new Date(`
- `toLocaleDateString` sobre campo `data_*`
- `parseISO` sobre DATE puro

### 2) Substituir por helpers existentes
Trocar nas exibições por:
- `formatDataAgendada(data)` quando só precisa exibir `dd/MM/yyyy`
- `parseDataLocal(data)` quando precisa do objeto Date para `format(..., "EEEE dd/MM")` etc.

### 3) Pontos críticos a corrigir (mínimo)
- Popup do mapa (campo "Data" na tarefa)
- Card/tooltip da tarefa atribuída
- Tooltip da base (contador + lista)
- Calendário da base
- Lista lateral de tarefas do dia

### 4) Não mexer no banco nem no hook de reagendamento
O `useReagendarTarefa` já envia `yyyy-MM-dd` correto. O bug é puramente de **renderização** no frontend.

### 5) Validação
Após o fix, recarregar `/monitoramento/mapa` e confirmar que a tarefa da Kelly aparece como **18/04/2026** no popup, no card e no calendário.

## Resultado esperado

Toda data DATE pura (`data_agendada`) renderiza no dia correto independentemente do fuso, eliminando o shift de -1 dia que aparece hoje em UTC-3.

