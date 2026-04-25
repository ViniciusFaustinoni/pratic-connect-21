import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export type EstadoTecnico =
  | 'em_servico'
  | 'deslocamento'
  | 'almoco'
  | 'ocioso'
  | 'inativo'
  | 'fora_turno';

export interface SegmentoEstado {
  inicio: string; // ISO
  fim: string; // ISO
  tipo: EstadoTecnico;
  servicoId?: string;
}

export interface EquipeMembroTempoReal {
  id: string;
  nome: string;
  fotoUrl: string | null;
  statusAtual: EstadoTecnico;
  inicioTurno: string | null;
  fimTurno: string | null;
  segmentos: SegmentoEstado[];
  totais: {
    em_servico: number; // minutos
    deslocamento: number;
    almoco: number;
    ocioso: number;
    inativo: number;
  };
  ultimoGpsEm: string | null;
  tarefas: { concluidas: number; total: number };
}

const LIMITE_INATIVO_MS = 25 * 60 * 1000; // 25min sem GPS = inativo
const HORA_COMERCIAL_INICIO = 8;
const HORA_COMERCIAL_FIM = 18;

function minutos(ms: number) {
  return Math.max(0, Math.round(ms / 60_000));
}

function dentroHorarioComercial(d: Date) {
  const h = d.getHours();
  return h >= HORA_COMERCIAL_INICIO && h < HORA_COMERCIAL_FIM;
}

/**
 * Reconstrói a linha do tempo do técnico no dia.
 * Preenche os gaps do turno como "ocioso" (ou "inativo" se sem GPS no horário comercial).
 */
function montarSegmentos(params: {
  inicioTurno: Date;
  fimTurno: Date;
  inicioAlmoco: Date | null;
  fimAlmoco: Date | null;
  servicos: Array<{
    id: string;
    em_rota_em: string | null;
    iniciada_em: string | null;
    concluida_em: string | null;
  }>;
  ultimoGps: Date | null;
}): SegmentoEstado[] {
  const { inicioTurno, fimTurno, inicioAlmoco, fimAlmoco, servicos, ultimoGps } = params;

  // 1) Construir blocos "duros" (almoço + serviços)
  type Bloco = { inicio: Date; fim: Date; tipo: EstadoTecnico; servicoId?: string };
  const blocos: Bloco[] = [];

  if (inicioAlmoco) {
    blocos.push({
      inicio: inicioAlmoco,
      fim: fimAlmoco ?? new Date(Math.min(Date.now(), fimTurno.getTime())),
      tipo: 'almoco',
    });
  }

  servicos.forEach((s) => {
    const emRota = s.em_rota_em ? new Date(s.em_rota_em) : null;
    const iniciada = s.iniciada_em ? new Date(s.iniciada_em) : null;
    const concluida = s.concluida_em ? new Date(s.concluida_em) : null;

    // Deslocamento: em_rota_em → iniciada_em (ou agora)
    if (emRota) {
      const fimDesl = iniciada ?? concluida ?? new Date();
      if (fimDesl > emRota) {
        blocos.push({ inicio: emRota, fim: fimDesl, tipo: 'deslocamento', servicoId: s.id });
      }
    }
    // Em serviço: iniciada_em → concluida_em (ou agora)
    if (iniciada) {
      const fimServ = concluida ?? new Date();
      if (fimServ > iniciada) {
        blocos.push({ inicio: iniciada, fim: fimServ, tipo: 'em_servico', servicoId: s.id });
      }
    }
  });

  // Ordenar e clamp ao turno
  blocos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const blocosClamped = blocos
    .map((b) => ({
      ...b,
      inicio: new Date(Math.max(b.inicio.getTime(), inicioTurno.getTime())),
      fim: new Date(Math.min(b.fim.getTime(), fimTurno.getTime())),
    }))
    .filter((b) => b.fim > b.inicio);

  // 2) Preencher gaps com ocioso/inativo
  const resultado: SegmentoEstado[] = [];
  let cursor = inicioTurno;
  const gpsInativo = ultimoGps && Date.now() - ultimoGps.getTime() > LIMITE_INATIVO_MS;

  for (const b of blocosClamped) {
    if (b.inicio > cursor) {
      // Determinar se gap é ocioso ou inativo (heurística simples baseada no GPS atual)
      const meioGap = new Date((cursor.getTime() + b.inicio.getTime()) / 2);
      const tipoGap: EstadoTecnico =
        gpsInativo && dentroHorarioComercial(meioGap) ? 'inativo' : 'ocioso';
      resultado.push({
        inicio: cursor.toISOString(),
        fim: b.inicio.toISOString(),
        tipo: tipoGap,
      });
    }
    resultado.push({
      inicio: b.inicio.toISOString(),
      fim: b.fim.toISOString(),
      tipo: b.tipo,
      servicoId: b.servicoId,
    });
    if (b.fim > cursor) cursor = b.fim;
  }
  if (cursor < fimTurno) {
    const meioGap = new Date((cursor.getTime() + fimTurno.getTime()) / 2);
    const tipoGap: EstadoTecnico =
      gpsInativo && dentroHorarioComercial(meioGap) ? 'inativo' : 'ocioso';
    resultado.push({
      inicio: cursor.toISOString(),
      fim: fimTurno.toISOString(),
      tipo: tipoGap,
    });
  }

  return resultado;
}

export function useEquipeTempoReal() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['equipe-tempo-real'],
    queryFn: async (): Promise<EquipeMembroTempoReal[]> => {
      const hoje = format(new Date(), 'yyyy-MM-dd');

      // 1. Turnos abertos hoje
      const { data: turnos, error: turnosErr } = await supabase
        .from('turnos_profissionais')
        .select('profissional_id, inicio_turno, fim_turno, inicio_almoco, fim_almoco')
        .eq('data', hoje)
        .not('inicio_turno', 'is', null);

      if (turnosErr) throw turnosErr;
      if (!turnos?.length) return [];

      const profIds = turnos.map((t: any) => t.profissional_id);

      // 2. Profiles + serviços do dia + última localização (em paralelo)
      const [{ data: profiles }, { data: servicos }, { data: locs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nome, foto_url')
          .in('id', profIds),
        supabase
          .from('servicos')
          .select('id, profissional_id, status, em_rota_em, iniciada_em, concluida_em')
          .eq('data_agendada', hoje)
          .in('profissional_id', profIds),
        supabase
          .from('vistoriadores_localizacao')
          .select('vistoriador_id, updated_at')
          .in('vistoriador_id', profIds),
      ]);

      const profById = new Map((profiles || []).map((p: any) => [p.id, p]));
      const locById = new Map((locs || []).map((l: any) => [l.vistoriador_id, l.updated_at as string]));
      const servicosByProf = new Map<string, any[]>();
      (servicos || []).forEach((s: any) => {
        if (!s.profissional_id) return;
        const arr = servicosByProf.get(s.profissional_id) || [];
        arr.push(s);
        servicosByProf.set(s.profissional_id, arr);
      });

      const agora = new Date();

      return turnos.map((t: any): EquipeMembroTempoReal => {
        const prof = profById.get(t.profissional_id);
        const inicioTurno = new Date(t.inicio_turno);
        const fimTurno = t.fim_turno ? new Date(t.fim_turno) : agora;
        const inicioAlmoco = t.inicio_almoco ? new Date(t.inicio_almoco) : null;
        const fimAlmoco = t.fim_almoco ? new Date(t.fim_almoco) : null;
        const ultimoGpsStr = locById.get(t.profissional_id) || null;
        const ultimoGps = ultimoGpsStr ? new Date(ultimoGpsStr) : null;
        const servs = servicosByProf.get(t.profissional_id) || [];

        const segmentos = montarSegmentos({
          inicioTurno,
          fimTurno,
          inicioAlmoco,
          fimAlmoco,
          servicos: servs,
          ultimoGps,
        });

        const totais = {
          em_servico: 0,
          deslocamento: 0,
          almoco: 0,
          ocioso: 0,
          inativo: 0,
        };
        segmentos.forEach((s) => {
          const dur = minutos(new Date(s.fim).getTime() - new Date(s.inicio).getTime());
          if (s.tipo in totais) (totais as any)[s.tipo] += dur;
        });

        // Status atual = tipo do último segmento (ou fora_turno se turno encerrado)
        let statusAtual: EstadoTecnico = 'fora_turno';
        if (!t.fim_turno && segmentos.length) {
          statusAtual = segmentos[segmentos.length - 1].tipo;
        }

        const concluidas = servs.filter((s) => s.status === 'concluida').length;
        const total = servs.length;

        return {
          id: t.profissional_id,
          nome: (prof as any)?.nome || 'Profissional',
          fotoUrl: (prof as any)?.foto_url || null,
          statusAtual,
          inicioTurno: t.inicio_turno,
          fimTurno: t.fim_turno,
          segmentos,
          totais,
          ultimoGpsEm: ultimoGpsStr,
          tarefas: { concluidas, total },
        };
      });
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Realtime: invalidar ao mudar serviços, turnos ou localização
  useEffect(() => {
    const channel = supabase
      .channel('equipe-tempo-real-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['equipe-tempo-real'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_profissionais' }, () => {
        queryClient.invalidateQueries({ queryKey: ['equipe-tempo-real'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vistoriadores_localizacao' }, () => {
        queryClient.invalidateQueries({ queryKey: ['equipe-tempo-real'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function formatarMinutos(min: number): string {
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const ESTADO_LABEL: Record<EstadoTecnico, string> = {
  em_servico: 'Em serviço',
  deslocamento: 'Em deslocamento',
  almoco: 'Almoço',
  ocioso: 'Ocioso',
  inativo: 'Inativo (h. comercial)',
  fora_turno: 'Fora do turno',
};

export const ESTADO_COLOR: Record<EstadoTecnico, string> = {
  em_servico: 'bg-primary',
  deslocamento: 'bg-blue-500',
  almoco: 'bg-amber-500',
  ocioso: 'bg-muted',
  inativo: 'bg-destructive',
  fora_turno: 'bg-transparent',
};
