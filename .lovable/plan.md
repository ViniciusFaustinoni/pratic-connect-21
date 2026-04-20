

## Corrigir bloqueio "Disponível em X min" — usar período em vez de hora exata

### Problema
A tarefa de Venilton tem `hora_agendada=15:00` mas o agendamento é por **período "tarde"**. O sistema bloqueia o botão "Iniciar Tarefa" até bater 15:00 cravadas, quando na verdade deveria liberar desde o início do período (12:00).

Há **dois pontos** que impõem o bloqueio por hora exata:
1. UI: `src/components/vistoriador/TarefaAtualCard.tsx` (linhas 92–108) — `podeIniciarPorHorario`
2. Server-side guard: `src/hooks/useTarefaAtual.ts` (linhas 228–236) — bloqueio antes do `iniciarRota`

### Solução
Trocar a referência de `hora_agendada` por **início do período** quando `tarefa.periodo` estiver presente. Manter `hora_agendada` apenas como rótulo informativo.

**Janela de início por período (constante nova em `src/lib/periodo-utils.ts`):**
```ts
export const PERIODO_INICIO: Record<'manha'|'tarde'|'noite', string> = {
  manha: '08:00',
  tarde: '12:00',
  noite: '18:00',
};
export function horaLiberacaoTarefa(tarefa: { periodo?: string|null; hora_agendada?: string|null; permite_encaixe?: boolean|null }): string | null {
  if (tarefa.permite_encaixe) return null; // libera imediato
  if (tarefa.periodo && PERIODO_INICIO[tarefa.periodo]) return PERIODO_INICIO[tarefa.periodo];
  return tarefa.hora_agendada ?? null;
}
```

### Arquivos tocados
1. **Novo:** `src/lib/periodo-utils.ts` — `PERIODO_INICIO` + `horaLiberacaoTarefa()`.
2. **Editar:** `src/components/vistoriador/TarefaAtualCard.tsx` — substituir uso de `tarefa.hora_agendada` em `podeIniciarPorHorario` e `tempoRestante` por `horaLiberacaoTarefa(tarefa)`. No texto do feedback, mostrar o início do período (ex.: "Disponível em 34 min — período da tarde começa às 12:00") em vez de "(15:00)".
3. **Editar:** `src/hooks/useTarefaAtual.ts` (mutation `iniciarRota`, linhas 228–236) — incluir `periodo` no `select` e usar `horaLiberacaoTarefa` antes de comparar com `horaAtual`. Mensagem de erro: "Período disponível a partir das HH:MM."

### Comportamento resultante
- Tarefa de Venilton (período tarde, hora_agendada 15:00): liberada às **12:00** em vez de 15:00.
- Tarefa sem `periodo` (legado): cai no fallback antigo (`hora_agendada`).
- Tarefa com `permite_encaixe=true`: continua liberada imediatamente.
- Hora agendada (15:00) continua sendo exibida no card como referência visual.

### Validação
1. Logar como técnico de Venilton agora (14:26) → botão "Iniciar Tarefa" deve estar **habilitado** (período tarde liberado desde 12:00).
2. Tarefa com período "manha" antes das 08:00 → bloqueio com mensagem "Disponível às 08:00".
3. Encaixe → libera imediato (sem mudança).
4. Tentar `iniciarRota` via mutation antes do início do período → erro server-side correto.

