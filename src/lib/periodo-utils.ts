// Início de cada período de atendimento (HH:MM)
export const PERIODO_INICIO: Record<'manha' | 'tarde' | 'noite', string> = {
  manha: '08:00',
  tarde: '12:00',
  noite: '18:00',
};

export const PERIODO_LABEL: Record<'manha' | 'tarde' | 'noite', string> = {
  manha: 'manhã',
  tarde: 'tarde',
  noite: 'noite',
};

/**
 * Retorna o horário (HH:MM) a partir do qual a tarefa pode ser iniciada.
 * - Encaixes: liberam imediato (null).
 * - Tarefas com período definido: usam o início do período (08:00 / 12:00 / 18:00).
 * - Fallback (sem período): usam hora_agendada.
 * - Sem período e sem hora: null (libera).
 */
export function horaLiberacaoTarefa(tarefa: {
  periodo?: string | null;
  hora_agendada?: string | null;
  permite_encaixe?: boolean | null;
}): string | null {
  if (tarefa.permite_encaixe) return null;
  const p = tarefa.periodo as 'manha' | 'tarde' | 'noite' | undefined | null;
  if (p && PERIODO_INICIO[p]) return PERIODO_INICIO[p];
  return tarefa.hora_agendada ? tarefa.hora_agendada.slice(0, 5) : null;
}
