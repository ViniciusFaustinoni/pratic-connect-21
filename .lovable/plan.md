

## Entendimento

Você quer unificar a gestão de plantões (que hoje vive em `/monitoramento/equipe` via `EscalaDiaPanel`/`PlantaoDiaModal`) dentro do **calendário do mapa de monitoramento** (`/monitoramento/mapa`), eliminando a aba `/monitoramento/equipe` que não está no sidebar.

A regra: **plantonista = técnico tipo Base naquele dia**, com horários idênticos aos slots de agendamento da base (manhã/tarde já configurados em `agendamentos_base`).

## Onde está hoje (rastreamento)

- `EscalaDiaPanel.tsx` + `PlantaoDiaModal.tsx` — em `/monitoramento/equipe` (rota órfã, fora do sidebar).
- Dados gravados em `alocacoes_diarias` (`tipo_alocacao`, `base_id`, `data`).
- Mapa (`/monitoramento/mapa`) já lê `alocacoes_diarias` via `useAlocacoesDiaHoje` para esconder técnicos base.
- Calendário do mapa: `CalendarioBaseModal` / `CalendarioDiaModal` (abrem ao clicar no ícone da base) — hoje só mostram fila de vistorias.

## Investigação rápida (próxima rodada)

1. Confirmar componentes do calendário no mapa (`CalendarioBaseModal`, `CalendarioDiaModal`) e se há um calendário "macro" multi-dia.
2. Verificar slots de horário usados em `agendamentos_base` (manhã/tarde fixos? configuráveis?).
3. Listar todas as referências a `EscalaDiaPanel`/`PlantaoDiaModal` para remover com segurança.
4. Conferir se há rota `/monitoramento/equipe` no router e se é referenciada em algum link interno.

## Plano

### 1) Novo "Gestor de Plantões" dentro do calendário da base

No popup do ícone da base no mapa, adicionar botão **"Gerenciar plantões"** que abre um modal-calendário mensal:

- Grid de dias do mês (4-5 semanas).
- Em cada dia: lista de slots de horário (mesmos do agendamento de base — manhã/tarde) com chips de técnicos plantonistas.
- Clicar num slot → seletor de profissionais → ao salvar, faz upsert em `alocacoes_diarias` com `tipo_alocacao='base'`, `base_id=<base do calendário>`, `data=<dia>`.

### 2) Plantão multi-dia (recorrência simples)

Botão "Definir plantão recorrente": escolhe técnico + dias da semana + período (de/até) → loop de upserts em `alocacoes_diarias`.

### 3) Auto-marca como Base

Toda gravação no novo gestor força `tipo_alocacao='base'` + `base_id`. Não precisa o coordenador escolher tipo — é implícito por estar no calendário daquela base.

### 4) Aba Equipe do mapa continua funcionando

O toggle Rota/Base manual no popup do vistoriador (aba Equipe) continua existindo para sobrescrever pontualmente o plantão (ex: técnico de rota cobrindo base de última hora).

### 5) Remover rota órfã `/monitoramento/equipe`

- Apagar `EscalaDiaPanel.tsx` e `PlantaoDiaModal.tsx` (lógica migra para o novo componente).
- Remover rota do router.
- Remover qualquer link que aponte para ela.

### 6) Hook novo `usePlantoesBaseMes(baseId, mes)`

Retorna mapa `data → slot → profissionais[]` para renderizar o calendário. Usa `alocacoes_diarias` filtrando por `base_id` e mês.

### 7) Slots de horário

Reaproveitar a constante de slots já usada em `agendamentos_base` (provavelmente `['manha', 'tarde']` ou horários fixos tipo `08:00`, `13:00`). Se hoje não há associação técnico↔slot na `alocacoes_diarias`, adicionar coluna opcional `slot text` na migration (se você quiser granularidade por turno; senão, plantão é do dia inteiro).

## Pergunta-chave antes de codar

Plantão deve ter **granularidade por slot** (técnico A na manhã, técnico B na tarde) ou **dia inteiro** (técnico cobre o dia todo da base)?

## Resultado

`/monitoramento/equipe` deixa de existir. No mapa, clicar na base → "Gerenciar plantões" → calendário mensal com slots iguais ao agendamento. Cada técnico colocado num dia/slot vira automaticamente Base naquele dia, somindo do mapa de rota e recebendo só vistorias daquela base.

