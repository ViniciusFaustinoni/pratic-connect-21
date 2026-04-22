// Início de cada período de atendimento (HH:MM)
export const PERIODO_INICIO: Record<'manha' | 'tarde' | 'noite', string> = {
  manha: '08:00',
  tarde: '13:00',
  noite: '18:00',
};

export const PERIODO_LABEL: Record<'manha' | 'tarde' | 'noite', string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export const PERIODO_FAIXA: Record<'manha' | 'tarde' | 'noite', string> = {
  manha: '08:00 – 12:00',
  tarde: '13:00 – 18:00',
  noite: '18:00 – 22:00',
};

export type PeriodoCanonico = 'manha' | 'tarde' | 'noite';

/**
 * Retorna o horário (HH:MM) a partir do qual a tarefa pode ser iniciada.
 * - Encaixes: liberam imediato (null).
 * - Tarefas com período definido: usam o início do período (08:00 / 13:00 / 18:00).
 * - Fallback (sem período): usam hora_agendada.
 * - Sem período e sem hora: null (libera).
 */
export function horaLiberacaoTarefa(tarefa: {
  periodo?: string | null;
  hora_agendada?: string | null;
  permite_encaixe?: boolean | null;
}): string | null {
  if (tarefa.permite_encaixe) return null;
  const p = tarefa.periodo as PeriodoCanonico | undefined | null;
  if (p && PERIODO_INICIO[p]) return PERIODO_INICIO[p];
  return tarefa.hora_agendada ? tarefa.hora_agendada.slice(0, 5) : null;
}

/**
 * Converte qualquer valor (canônico 'manha'/'tarde'/'noite' OU legado HH:MM
 * OU rótulo 'Manhã'/'Tarde') no rótulo de período legível.
 * Útil para exibir registros antigos sem quebrar.
 */
export function formatPeriodoLabel(value?: string | null): string {
  if (!value) return '—';
  const v = value.trim().toLowerCase();
  if (v === 'manha' || v === 'manhã') return 'Manhã';
  if (v === 'tarde') return 'Tarde';
  if (v === 'noite') return 'Noite';
  // legado HH:MM
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h < 12) return 'Manhã';
    if (h < 18) return 'Tarde';
    return 'Noite';
  }
  return value;
}

/**
 * Converte um horário legado HH:MM em período canônico ('manha' | 'tarde' | 'noite').
 */
export function periodoFromHora(hora?: string | null): PeriodoCanonico {
  if (!hora) return 'manha';
  const h = parseInt(hora.slice(0, 2), 10);
  if (Number.isNaN(h)) return 'manha';
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

/**
 * Converte um período canônico ('manha' | 'tarde' | 'noite') em valor `time`
 * aceito pelo Postgres (HH:MM:SS). Se já vier em HH:MM(:SS) repassa.
 * Use sempre antes de gravar em colunas `time` (ex.: agendamentos_base.horario).
 */
export function periodoToTime(value?: string | null): string {
  if (!value) return '08:00:00';
  const v = value.trim().toLowerCase();
  if (v === 'manha' || v === 'manhã') return '08:00:00';
  if (v === 'tarde') return '13:00:00';
  if (v === 'noite') return '18:00:00';
  // já é HH:MM ou HH:MM:SS
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (m) {
    const hh = m[1].padStart(2, '0');
    return `${hh}:${m[2]}:${m[3] || '00'}`;
  }
  return '08:00:00';
}

/**
 * Normaliza qualquer valor (canônico ou HH:MM) em período canônico.
 */
export function normalizePeriodo(value?: string | null): PeriodoCanonico {
  if (!value) return 'manha';
  const v = value.trim().toLowerCase();
  if (v === 'manha' || v === 'manhã') return 'manha';
  if (v === 'tarde') return 'tarde';
  if (v === 'noite') return 'noite';
  return periodoFromHora(v);
}
