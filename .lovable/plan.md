

## Plano: Modal de detalhes do dia no Calendário de Monitoramento

### O que muda

Ao clicar em um dia no calendário (`CalendarioInstalacoes.tsx`), em vez de navegar para `/monitoramento/instalacoes?data=...`, abre um **Dialog modal** com as tarefas daquele dia organizadas em duas abas: **Rota** e **Base**.

### Estrutura do Modal

```text
┌──────────────────────────────────────────────┐
│  📅 Tarefas do dia 16 de Abril de 2026       │
│                                              │
│  [🚐 Rota (5)]  [🏢 Base (3)]               │
│  ─────────────────────────────────────────── │
│  Aba Rota:                                   │
│   Lista de instalações + vistorias campo     │
│   agrupadas por período (Manhã/Tarde/Noite)  │
│   com status, placa, associado, técnico      │
│                                              │
│  Aba Base:                                   │
│   Lista de agendamentos_base do dia          │
│   com horário, cliente, placa, status        │
│   + Botão "Antecipar" em tarefas futuras     │
│     → Abre select de técnico base ativo      │
│     → Atualiza data_agendada para hoje       │
│     → Atribui atendido_por ao técnico        │
└──────────────────────────────────────────────┘
```

### Alterações

**1. Novo componente: `src/components/monitoramento/CalendarioDiaModal.tsx`**

- Recebe `open`, `onClose`, `data` (string yyyy-MM-dd)
- Usa `Dialog` do shadcn
- Duas abas via `Tabs`: "Rota" e "Base"
- **Aba Rota**: Query `instalacoes` + `vistorias` (campo) filtradas pela data selecionada. Mostra cards com período, placa, associado, status (badge colorido), técnico atribuído
- **Aba Base**: Query `agendamentos_base` filtrada pela data. Mostra cards com horário, cliente, placa, status, atendido_por
- Na aba Base, tarefas com `data_agendada` futura (> hoje) mostram botão **"Antecipar para Hoje"**
  - Ao clicar, abre um `Select` com técnicos base ativos (query `useProfissionaisEquipe` filtrado por `ativo && status !== 'ferias'`)
  - Ao confirmar, faz `update` no `agendamentos_base`: `data_agendada = hoje`, `atendido_por = tecnicoId`, `status = 'confirmado'`
  - Invalida queries do calendário

**2. Modificar `src/pages/monitoramento/CalendarioInstalacoes.tsx`**

- Adicionar estado `diaSelecionado` (string | null)
- No `onClick` da célula do dia (linha 337): em vez de `navigate(...)`, setar `setDiaSelecionado(dataStr)`
- Renderizar `<CalendarioDiaModal>` com `open={!!diaSelecionado}`

**3. Hook auxiliar no mesmo componente**

- Query de instalações e vistorias do dia selecionado (reutiliza queries existentes, filtrando pelo dia)
- Query de `agendamentos_base` do dia (reutiliza `useAgendamentosBaseDia`)
- Mutation para antecipar: atualiza `agendamentos_base.data_agendada` + `atendido_por`

### Detalhes técnicos

- Técnicos base ativos: `useProfissionaisEquipe()` filtrado por `ativo === true`
- Antecipar = mudar `data_agendada` para hoje + atribuir `atendido_por` + status `confirmado`
- Invalidar queries: `agendamentos-base-calendario`, `agendamentos-base-dia`, `vistorias-calendario`
- O modal reutiliza os mesmos estilos de badge/status já existentes em `AgendamentosBase.tsx`

