## Objetivo

Eliminar o bloqueio por horário fixo na Vistoria Base. Hoje a coluna `agendamentos_base.horario` (tipo `time`) é gravada como 08:00 / 13:00 e exibida como "Hoje às 09:00", o que dá ao cliente/atendente a falsa expectativa de que o atendimento só pode começar naquele horário. Vamos passar a tratar e exibir tudo apenas como **período (Manhã / Tarde)**.

A boa notícia: o início da vistoria já não é bloqueado por horário no fluxo do técnico (`TarefaAtualCard` mantém `horaLiberacao` apenas como referência informativa, sem travar o botão). Ou seja, o bug é principalmente de **representação**: a UI mostra um horário fixo que não existe como regra de negócio. A correção é de exibição + persistência semântica.

## Escopo das mudanças

### 1. Persistência (mantém compatibilidade)

A coluna `agendamentos_base.horario` continua existindo (é `time NOT NULL` em vários lugares e há histórico). Vamos:

- **Continuar gravando** `08:00:00` para Manhã e `13:00:00` para Tarde (já é o que `periodoToTime` faz). Isso preserva ordenação e dados legados.
- **Não exibir mais** esse valor como "horário do agendamento" em nenhum lugar voltado ao cliente, atendente da base ou técnico. Tratar sempre como período derivado (`normalizePeriodo(horario)` → `'manha' | 'tarde'`).

Sem migração SQL necessária neste passo.

### 2. UI — substituir "horário" por "período"

Arquivos a editar:

- `src/components/instalador/FilaBaseSection.tsx`
  - Trocar `const horario = item.horario?.slice(0,5)` pelo rótulo de período (`PERIODO_LABEL[normalizePeriodo(item.horario)]`, ex.: "Manhã" / "Tarde", com a faixa "08:00–12:00" abaixo).
  - Esse é exatamente o card "Hoje às 09:00" do print enviado.

- `src/components/cotacao-publica/AgendamentoBaseResumo.tsx`
  - Linha 83–91: trocar "Horário" + `agendamento.horario` por "Período" + rótulo de período + faixa horária da base.

- `src/components/monitoramento/AgendamentosBase.tsx` (linha 106)
  - Trocar `agendamento.horario.slice(0,5)` por badge de período (Manhã/Tarde).
  - Manter ordenação por `horario` (08:00 < 13:00 já ordena Manhã antes de Tarde).

- `src/components/monitoramento/CalendarioDiaModal.tsx` (linhas 303 e 553)
  - Substituir `${baseData?.horario}` e `{ag.horario}` pelo rótulo de período.

- `src/components/cotacao-publica/AgendamentoBase.tsx`
  - Já é período-only (Manhã/Tarde). Apenas conferir que o texto "Manhã 08:00–12:00 · Tarde 13:00–18:00" continue, e remover qualquer expectativa de horário exato no card de confirmação (já está OK).

### 3. Mensagens automáticas / WhatsApp

- `src/hooks/useContratoLink.ts` já formata mensagens com "Manhã"/"Tarde" via `periodoLabel` — manter.
- Buscar e ajustar quaisquer outros templates que ainda mencionem hora fixa para vistoria base (a busca inicial não encontrou bloqueios; faremos um `rg` final antes de editar para garantir).

### 4. Validação de "início antecipado"

Confirmado por leitura de código:
- `TarefaAtualCard.tsx` (linha 86–91): `horaLiberacao` é apenas referência informativa, **não** bloqueia o botão "Iniciar".
- `useFilaBaseHoje` / `usePegarVistoriaBase`: não há checagem de horário; o técnico pode pegar e iniciar a qualquer momento do dia.
- `realocar_servico` (RPC) e edge functions de vistoria base: não validam hora.

Portanto **nenhum bloqueio precisa ser removido no servidor** — o problema relatado é causado pela exibição "Hoje às 09:00", que faz o atendente acreditar que existe uma trava. Após o ajuste de UI, o técnico/atendente verá "Hoje — Manhã" e iniciará normalmente quando o cliente chegar.

### 5. Memória do projeto

Adicionar memória nova (`mem://logic/operations/vistoria-base-periodo-only`) registrando: Vistoria Base é por **período** (Manhã/Tarde); a coluna `horario` é apenas marcador interno (08:00/13:00) para ordenação e **nunca** deve ser exibida como horário de atendimento.

## Detalhes técnicos

```text
agendamentos_base.horario  (time NOT NULL)
  ├── INSERT: continua 08:00:00 (manhã) ou 13:00:00 (tarde)  ← sem mudança
  ├── ORDER BY horario ASC                                    ← sem mudança
  └── UI: nunca exibir; sempre derivar período via
          normalizePeriodo(horario) → PERIODO_LABEL[p]
```

Helpers já existentes em `src/lib/periodo-utils.ts` (`normalizePeriodo`, `PERIODO_LABEL`, `PERIODO_FAIXA`) cobrem 100% da formatação — basta importá-los nos 4 componentes citados.

## Fora do escopo

- Não vamos remover/renomear a coluna `horario` (risco alto, baixo benefício, quebra histórico).
- Não vamos mexer em vistoria de rua/agendada com técnico (já é período-only).
- Não vamos abrir um novo modelo de capacidade (continua a regra de capacidade por período já existente).

## Resultado esperado

- Card da fila do técnico passa de "Hoje às 09:00" para "Hoje — Manhã (08:00–12:00)".
- Resumo do agendamento na contratação pública passa de "Horário: 08:00:00" para "Período: Manhã".
- Painel de monitoramento mostra badge "Manhã"/"Tarde" no lugar do "08:00".
- Atendente sabe que pode iniciar a vistoria assim que o associado chegar, dentro do período.
