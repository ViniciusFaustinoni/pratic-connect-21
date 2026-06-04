// Roteador de Habilidades de IA — canônico
//
// Resolve qual habilidade ativa atende uma audiência específica.
// Quando NENHUMA habilidade ativa cobre a audiência, devolve um
// resultado pausado (com mensagem padrão + intenção de transbordo)
// e o caller deve responder o usuário e abrir transbordo.
//
// Ver mem://logic/ia/habilidades-canonicas

export type IAAudiencia = 'lead' | 'associado' | 'diretor';

export interface IAHabilidadeRow {
  slug: string;
  nome_exibicao: string;
  ativa: boolean;
  nome_agente: string;
  persona: string;
  regras_absolutas: string;
  tom_voz: string;
  saudacao_inicial: string;
  audiencias_elegiveis: string[];
  ferramentas_habilitadas: string[];
  prioridade_roteamento: number;
  horario_atendimento: any | null;
  mensagem_fora_horario: string | null;
}

export interface RoteamentoResultado {
  habilidade: IAHabilidadeRow | null;
  motivo: 'audiencia_unica' | 'desempate_por_prioridade' | 'nenhuma_ativa' | 'audiencia_invalida';
  mensagem_pausa?: string;
}

const MENSAGEM_PAUSA_PADRAO =
  'Olá! Nosso atendimento por IA está temporariamente pausado. Em instantes um atendente humano vai falar com você. 🙏';

export async function resolverHabilidade(
  supabase: any,
  audiencia: IAAudiencia,
): Promise<RoteamentoResultado> {
  if (!['lead', 'associado', 'diretor'].includes(audiencia)) {
    return { habilidade: null, motivo: 'audiencia_invalida', mensagem_pausa: MENSAGEM_PAUSA_PADRAO };
  }

  const { data, error } = await supabase
    .from('ia_habilidades')
    .select('*')
    .eq('ativa', true)
    .contains('audiencias_elegiveis', [audiencia])
    .order('prioridade_roteamento', { ascending: true });

  if (error) {
    console.error('[roteador-ia] erro ao consultar ia_habilidades', error);
    return { habilidade: null, motivo: 'nenhuma_ativa', mensagem_pausa: MENSAGEM_PAUSA_PADRAO };
  }

  const ativas = (data || []) as IAHabilidadeRow[];
  if (ativas.length === 0) {
    return { habilidade: null, motivo: 'nenhuma_ativa', mensagem_pausa: MENSAGEM_PAUSA_PADRAO };
  }

  const escolhida = ativas[0];
  return {
    habilidade: escolhida,
    motivo: ativas.length === 1 ? 'audiencia_unica' : 'desempate_por_prioridade',
  };
}

// Verifica se a habilidade está dentro do horário de atendimento.
// Retorna { dentro: true } se 24/7 ou se horário válido.
export function dentroDoHorario(h: IAHabilidadeRow, agora: Date = new Date()): {
  dentro: boolean;
  mensagem?: string;
} {
  if (!h.horario_atendimento || !h.horario_atendimento.inicio || !h.horario_atendimento.fim) {
    return { dentro: true };
  }

  const tz = h.horario_atendimento.timezone || 'America/Sao_Paulo';
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(agora);
  const wd = (parts.find(p => p.type === 'weekday')?.value || '').toLowerCase();
  const hh = parts.find(p => p.type === 'hour')?.value || '00';
  const mm = parts.find(p => p.type === 'minute')?.value || '00';

  const map: Record<string, string> = { mon: 'seg', tue: 'ter', wed: 'qua', thu: 'qui', fri: 'sex', sat: 'sab', sun: 'dom' };
  const diaPt = map[wd] || wd;
  const diasOk: string[] = (h.horario_atendimento.dias || []).map((d: string) => d.toLowerCase());
  if (diasOk.length && !diasOk.includes(diaPt)) {
    return { dentro: false, mensagem: h.mensagem_fora_horario || undefined };
  }

  const agoraMin = parseInt(hh) * 60 + parseInt(mm);
  const [ih, im] = String(h.horario_atendimento.inicio).split(':').map(Number);
  const [fh, fm] = String(h.horario_atendimento.fim).split(':').map(Number);
  const inicioMin = ih * 60 + (im || 0);
  const fimMin = fh * 60 + (fm || 0);

  if (agoraMin < inicioMin || agoraMin >= fimMin) {
    return { dentro: false, mensagem: h.mensagem_fora_horario || undefined };
  }
  return { dentro: true };
}
