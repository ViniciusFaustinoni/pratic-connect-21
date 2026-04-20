

## Padronizar todos os agendamentos para PERÍODO (manhã/tarde) e eliminar horários fixos remanescentes

### Diagnóstico
A regra de negócio atual é “agendamento por período” (manhã/tarde), e várias telas já foram migradas. Porém ainda restam pontos que continuam usando/expondo **horário fixo (HH:MM)**, o que gera o "11:00:00" mostrado no resumo da proposta e inconsistência operacional:

1. **Vistoria na Base (fluxo público)** — `src/components/cotacao-publica/AgendamentoBase.tsx`
   - Gera slots de 30 em 30 min (`08:00, 08:30, ..., 17:30`) via `configBase.base_horario_inicio/fim`.
   - Salva `agendamentos_base.horario = "11:00"`. É exatamente o horário que aparece em **PropostaApprovalStepper** ("às 11:00:00") e em **PropostaDetalhesTabs** (aba Vistoria → campo "Horário").

2. **Modal de Agendar Vistoria interno** — `src/components/monitoramento/AgendarVistoriaModal.tsx`
   - Constante `HORARIOS = ['08:00','08:30',...]` com select de "Horário Específico (opcional)" além do período.
   - Mantém a porta aberta para gravar `hora_agendada` específico mesmo quando a regra é só período.

3. **Reagendar instalação (admin)** — `src/components/instalacoes/RealocarInstalacaoDialog.tsx` + `src/hooks/useRealocarInstalacao.ts`
   - Campo `horarioBase` default `'09:00'` e gravação de `hora_agendada` no `servicos`.

4. **Reagendar tarefa do mapa** — `src/components/mapa/ReagendarTarefaDialog.tsx`
   - Default `novaHora = "09:00"`, envia hora específica.

5. **Conversão de agendamento de base → rota** — `src/hooks/useAlterarEnderecoTipo.ts` (linhas 230–233)
   - Usa `hora_agendada: input.horario || ab.horario` e força `periodo: 'manha'` (independente do horário escolhido) → inconsistência.

6. **Agendar vistoria pelo associado (link)** — `src/components/associado/AgendarVistoria.tsx`
   - Usa `getHorariosParaDia()` (LEGADO em `autovistoriaConfig.ts`) com lista de horários cheios e grava `horarioAgendado: "10:00"` em `vistorias`.

7. **Visual restante** — `src/pages/monitoramento/GestaoRotas.tsx` mostra `09:00 / 14:00` fixo a partir do período, o que está OK (apenas exibição), mas confunde usuários que esperam ver "Manhã / Tarde". Vamos padronizar.

8. **Edge function `agendar-vistoria-completa`** ainda grava `vistoria_completa_horario_agendado` (HH:MM). Como a `agendar-vistoria-presencial` já zera esse campo e usa `vistoria_periodo`, replicar o mesmo padrão na função de autovistoria/vistoria completa.

### O que será implementado

#### 1. `AgendamentoBase.tsx` (vistoria na base, fluxo público) — virar período
- Remover seleção de slot HH:MM. Substituir por dois cards grandes: **Manhã (08:00–12:00)** e **Tarde (13:00–18:00)** (ou conforme `base_horario_inicio/fim` configurados).
- Capacidade passa a ser por período (somar `base_capacidade_horario` por slot dentro do período) → mostrar “X vagas restantes”.
- `useCriarAgendamentoBase` passa a gravar `horario` com valor canônico do período (`'manha'` / `'tarde'`) **e** novo campo `periodo` se já existir; manter compatibilidade gravando também `horario` legível (`'Manhã'`/`'Tarde'`) — definir 1 só padrão (preferência: armazenar `'manha'`/`'tarde'` em `horario` e ajustar leitores).
- `useHorariosDisponiveis` passa a contar agendamentos por período.

#### 2. `PropostaApprovalStepper.tsx` e `PropostaDetalhesTabs.tsx`
- Renderizar `vistoria_base_info.horario` como **rótulo de período** (`Manhã` / `Tarde`) em vez de “11:00:00”.
- Helper compartilhado (ex.: `formatPeriodoLabel`) que entende tanto valores antigos (HH:MM) quanto novos (`manha`/`tarde`) — para não quebrar registros existentes.

#### 3. `AgendarVistoriaModal.tsx` (monitoramento interno)
- Remover constante `HORARIOS` e o campo “Horário Específico (opcional)”.
- Manter apenas seleção de **Período** (Manhã / Tarde).
- Garantir que o submit nunca envie `hora_agendada`.

#### 4. `RealocarInstalacaoDialog.tsx` + `useRealocarInstalacao.ts`
- Trocar input de hora por seletor de **Período**.
- Hook passa a enviar `periodo` em vez de `hora_agendada` (deixar `hora_agendada = null`).

#### 5. `ReagendarTarefaDialog.tsx`
- Substituir `novaHora` (HH:MM) por `novoPeriodo`.
- Enviar `periodo` na mutação; backend cancela hora específica.

#### 6. `useAlterarEnderecoTipo.ts`
- Remover `hora_agendada`. Derivar `periodo` real do agendamento de base (mapear horário do `ab.horario` → `manha`/`tarde` via `< 12 ? 'manha' : 'tarde'` enquanto houver dados antigos).

#### 7. `AgendarVistoria.tsx` (associado/link contrato)
- Substituir `getHorariosParaDia` por seleção de período (mesmo padrão dos demais).
- `useCriarVistoriaAgendada` deixa de receber `horarioAgendado` (HH:MM) e passa a receber `periodo`.

#### 8. `data/autovistoriaConfig.ts`
- Marcar `HORARIOS_DISPONIVEIS`, `HORARIOS_SABADO` e `getHorariosParaDia` como **deprecated** com `@deprecated` e remover dos imports após migração dos arquivos acima.

#### 9. Edge function `agendar-vistoria-completa`
- Passar a gravar `vistoria_completa_periodo` e `vistoria_completa_horario_agendado = null`, igual à `agendar-vistoria-presencial`.

#### 10. `GestaoRotas.tsx` (apenas exibição)
- Trocar `instalacao.periodo === 'manha' ? '09:00' : '14:00'` por `Manhã` / `Tarde`.

#### 11. Backfill suave (sem migration de schema)
- Não alterar dados antigos. Os componentes leem com helper que aceita HH:MM (legado) e exibe como o período correspondente, então registros antigos continuam fazendo sentido visualmente.

### Arquivos editados

**Frontend**
- `src/components/cotacao-publica/AgendamentoBase.tsx`
- `src/hooks/useAgendamentoBase.ts`
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`
- `src/components/monitoramento/AgendarVistoriaModal.tsx`
- `src/components/instalacoes/RealocarInstalacaoDialog.tsx`
- `src/hooks/useRealocarInstalacao.ts`
- `src/components/mapa/ReagendarTarefaDialog.tsx`
- `src/hooks/useAlterarEnderecoTipo.ts`
- `src/components/associado/AgendarVistoria.tsx`
- `src/hooks/useContratoLink.ts` (assinatura de `useCriarVistoriaAgendada`)
- `src/pages/monitoramento/GestaoRotas.tsx`
- `src/data/autovistoriaConfig.ts` (marcar deprecated)
- `src/lib/periodo-utils.ts` (adicionar `formatPeriodoLabel(value)` aceitando legado HH:MM)

**Edge functions**
- `supabase/functions/agendar-vistoria-completa/index.ts`

**Sem alteração de schema/migration.**

### Detalhes técnicos
```
formatPeriodoLabel(value):
  if value in {'manha','tarde','noite'} -> 'Manhã'|'Tarde'|'Noite'
  else if value matches /^\d{2}:\d{2}/ -> hora<12 ? 'Manhã' : hora<18 ? 'Tarde' : 'Noite'
  else -> '—'
```

```
Telas com seleção de período (padrão único):
[ Manhã  08:00 – 12:00 ]   [ Tarde  13:00 – 18:00 ]
   X vagas                    Y vagas
```

### Validação
1. Refazer agendamento de **vistoria na base** no fluxo público → `agendamentos_base.horario` recebe `manha`/`tarde`; tela do diretor (Resumo da Análise) mostra **"agendado para 20/04/2026 — Manhã"**, sem `11:00:00`.
2. Abrir aba Vistoria de uma proposta antiga (com `horario` HH:MM) → continua exibindo coerentemente como **Manhã** ou **Tarde** sem quebrar.
3. `Monitoramento → Agendar Vistoria` não mostra mais campo "Horário Específico"; gera serviço com `hora_agendada = null` e `periodo` correto.
4. `Realocar Instalação` e `Reagendar Tarefa do Mapa` operam apenas por período; serviço gerado fica com `hora_agendada = null`.
5. `Conversão Base → Rota` (`useAlterarEnderecoTipo`) gera `servicos.periodo` correto, sem hora.
6. Link público de **Agendar Vistoria** (associado) cria vistoria com período, sem HH:MM.
7. Edge function `agendar-vistoria-completa` salva `vistoria_completa_periodo` e zera `vistoria_completa_horario_agendado`.
8. Vagas por período continuam respeitando `LIMITE_VAGAS_POR_PERIODO`.
9. Sem regressão em `processar-encaixes-automaticos` (continua lendo `hora_agendada`/`horario_agendado` quando existir, mas para registros novos esses campos serão null e o filtro por janela é tolerante a null).
10. `GestaoRotas` exibe "Manhã"/"Tarde" em vez de 09:00/14:00.

