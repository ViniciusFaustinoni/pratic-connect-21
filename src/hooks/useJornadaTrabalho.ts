import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getHojeBrasilia } from '@/lib/date-utils';

interface TurnoProfissional {
  id: string;
  profissional_id: string;
  data: string;
  inicio_turno: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  fim_turno: string | null;
  minutos_trabalhados: number;
  minutos_almoco: number;
  minutos_extras: number;
  minutos_faltantes: number;
  saldo_anterior_minutos: number;
  minutos_atraso_almoco: number;
  status: 'ativo' | 'em_almoco' | 'encerrado';
  encerrado_automaticamente: boolean;
}

export interface JornadaState {
  turno: TurnoProfissional | null;
  
  // Tempo calculado em tempo real
  minutosTrabalhados: number;
  minutosRestantes: number;
  percentualJornada: number;
  
  // Almoço
  emAlmoco: boolean;
  minutosAlmoco: number;
  minutosAlmocoRestantes: number;
  deveIniciarAlmoco: boolean;
  
  // Atraso de almoço
  minutosAtrasoAlmoco: number;
  emAtrasoAlmoco: boolean;
  
  // Saldo
  saldoAnterior: number;
  jornadaAjustada: number;
  
  // Status
  status: 'inativo' | 'trabalhando' | 'almoco' | 'encerrado';
}

// Fallback defaults (used when DB config unavailable)
const FALLBACK_JORNADA = 480;
const FALLBACK_ATE_ALMOCO = 240;
const FALLBACK_DURACAO_ALMOCO = 60;

/**
 * Hook para controle de jornada de trabalho do vistoriador/instalador
 * 
 * Regras:
 * - Jornada padrão: 8 horas de trabalho efetivo
 * - Almoço obrigatório: 1 hora, após 4h de trabalho
 * - Banco de horas: horas extras viram crédito, horas faltantes viram débito
 */
export function useJornadaTrabalho() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tempoReal, setTempoReal] = useState<{ minutosTrabalhados: number; minutosAlmoco: number }>({
    minutosTrabalhados: 0,
    minutosAlmoco: 0
  });
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hojeStr = getHojeBrasilia().toISOString().split('T')[0];

  // Query para buscar configs de jornada do banco
  const { data: configJornada } = useQuery({
    queryKey: ['config-jornada'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['jornada_duracao_turno_horas', 'jornada_horas_ate_almoco', 'jornada_duracao_almoco_minutos']);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        jornadaMinutos: Math.round((parseFloat(map.jornada_duracao_turno_horas) || 8) * 60),
        ateAlmocoMinutos: Math.round((parseFloat(map.jornada_horas_ate_almoco) || 4) * 60),
        duracaoAlmocoMinutos: parseInt(map.jornada_duracao_almoco_minutos) || 60,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const JORNADA_PADRAO_MINUTOS = configJornada?.jornadaMinutos ?? FALLBACK_JORNADA;
  const TEMPO_ATE_ALMOCO_MINUTOS = configJornada?.ateAlmocoMinutos ?? FALLBACK_ATE_ALMOCO;
  const DURACAO_ALMOCO_MINUTOS = configJornada?.duracaoAlmocoMinutos ?? FALLBACK_DURACAO_ALMOCO;

  // Query para buscar turno de hoje
  const { data: turno, refetch: refetchTurno, isLoading } = useQuery({
    queryKey: ['turno-profissional', profile?.id, hojeStr],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from('turnos_profissionais')
        .select('*')
        .eq('profissional_id', profile.id)
        .eq('data', hojeStr)
        .maybeSingle();

      if (error) {
        console.error('[useJornadaTrabalho] Erro ao buscar turno:', error);
        return null;
      }

      return data as TurnoProfissional | null;
    },
    enabled: !!profile?.id,
    staleTime: 10000,
    refetchInterval: 30000, // Polling a cada 30s (fallback do realtime)
  });

  // Realtime subscription para turnos_profissionais
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`turno-realtime-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turnos_profissionais',
          filter: `profissional_id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('[useJornadaTrabalho] Realtime update:', payload.eventType);
          refetchTurno();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, refetchTurno]);

  // Buscar saldo acumulado do dia anterior (extras - faltantes)
  const { data: saldoAnterior } = useQuery({
    queryKey: ['saldo-anterior', profile?.id, hojeStr],
    queryFn: async () => {
      if (!profile?.id) return 0;

      const { data, error } = await supabase
        .from('turnos_profissionais')
        .select('minutos_extras, minutos_faltantes, saldo_anterior_minutos')
        .eq('profissional_id', profile.id)
        .lt('data', hojeStr)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return 0;

      // Saldo acumulado = saldo anterior do dia + extras - faltantes daquele dia
      const saldoDoDia = (data.minutos_extras || 0) - (data.minutos_faltantes || 0);
      return saldoDoDia + (data.saldo_anterior_minutos || 0);
    },
    enabled: !!profile?.id,
    staleTime: 300000, // 5 minutos
  });

  // Calcular tempo em tempo real
  const calcularTempoReal = useCallback(() => {
    if (!turno?.inicio_turno) {
      setTempoReal({ minutosTrabalhados: 0, minutosAlmoco: 0 });
      return;
    }

    const agora = new Date();
    const inicio = new Date(turno.inicio_turno);
    const minutosDesdeInicio = Math.floor((agora.getTime() - inicio.getTime()) / 60000);

    let minutosAlmoco = 0;

    if (turno.status === 'em_almoco' && turno.inicio_almoco) {
      // Em almoço: calcular tempo de almoço decorrido
      const inicioAlmoco = new Date(turno.inicio_almoco);
      minutosAlmoco = Math.floor((agora.getTime() - inicioAlmoco.getTime()) / 60000);
    } else if (turno.fim_almoco && turno.inicio_almoco) {
      // Almoço já finalizado: usar tempo real gasto (pode incluir atraso)
      const inicioAlmoco = new Date(turno.inicio_almoco);
      const fimAlmoco = new Date(turno.fim_almoco);
      minutosAlmoco = Math.floor((fimAlmoco.getTime() - inicioAlmoco.getTime()) / 60000);
    }

    // Descontar almoço do tempo trabalhado
    // Durante o almoço, o tempo trabalhado para de avançar (minutosAlmoco acompanha o clock)
    const minutosTrabalhados = Math.max(0, minutosDesdeInicio - minutosAlmoco);

    setTempoReal({ minutosTrabalhados, minutosAlmoco });
  }, [turno]);

  // Atualizar tempo a cada 30 segundos para feedback mais rápido
  useEffect(() => {
    if (turno?.status && turno.status !== 'encerrado') {
      calcularTempoReal();
      intervalRef.current = setInterval(calcularTempoReal, 30000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [turno?.status, calcularTempoReal]);

  // Recalcular ao voltar do background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && turno?.status && turno.status !== 'encerrado') {
        console.log('[useJornadaTrabalho] Voltou ao foreground - recalculando tempo');
        calcularTempoReal();
        refetchTurno();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [turno?.status, calcularTempoReal, refetchTurno]);

  // Mutation para criar/iniciar turno (protege contra sobrescrita de inicio_turno)
  const iniciarTurnoMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      // Verificar se já existe turno hoje
      const { data: existente } = await supabase
        .from('turnos_profissionais')
        .select('id, inicio_turno, status')
        .eq('profissional_id', profile.id)
        .eq('data', hojeStr)
        .maybeSingle();

      if (existente?.inicio_turno) {
        // Turno já existe - apenas reativar se encerrado
        if (existente.status === 'encerrado') {
          const { data, error } = await supabase
            .from('turnos_profissionais')
            .update({ status: 'ativo', fim_turno: null })
            .eq('id', existente.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        }
        // Já ativo - retornar como está
        return existente;
      }

      // Criar novo turno
      const { data, error } = await supabase
        .from('turnos_profissionais')
        .insert({
          profissional_id: profile.id,
          data: hojeStr,
          inicio_turno: new Date().toISOString(),
          saldo_anterior_minutos: saldoAnterior || 0,
          status: 'ativo'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchTurno();
      queryClient.invalidateQueries({ queryKey: ['turno-profissional'] });
    },
    onError: (error) => {
      console.error('[useJornadaTrabalho] Erro ao iniciar turno:', error);
      toast.error('Erro ao registrar início do turno');
    }
  });

  // Mutation para iniciar almoço
  const iniciarAlmocoMutation = useMutation({
    mutationFn: async () => {
      if (!turno?.id) throw new Error('Turno não encontrado');

      const { data, error } = await supabase
        .from('turnos_profissionais')
        .update({
          status: 'em_almoco',
          inicio_almoco: new Date().toISOString()
        })
        .eq('id', turno.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchTurno();
      toast.info('Horário de almoço iniciado');
    },
    onError: (error) => {
      console.error('[useJornadaTrabalho] Erro ao iniciar almoço:', error);
      toast.error('Erro ao registrar almoço');
    }
  });

  // Mutation para finalizar almoço
  const finalizarAlmocoMutation = useMutation({
    mutationFn: async () => {
      if (!turno?.id || !turno?.inicio_almoco) throw new Error('Turno não encontrado');

      // Calcular atraso de almoço (além de 60 minutos)
      const inicioAlmoco = new Date(turno.inicio_almoco);
      const agora = new Date();
      const duracaoRealMinutos = Math.floor((agora.getTime() - inicioAlmoco.getTime()) / 60000);
      const minutosAtraso = Math.max(0, duracaoRealMinutos - DURACAO_ALMOCO_MINUTOS);

      const { data, error } = await supabase
        .from('turnos_profissionais')
        .update({
          status: 'ativo',
          fim_almoco: agora.toISOString(),
          minutos_atraso_almoco: minutosAtraso
        })
        .eq('id', turno.id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, minutosAtraso };
    },
    onSuccess: (data) => {
      refetchTurno();
      if (data.minutosAtraso > 0) {
        toast.warning(`Almoço finalizado com ${formatarMinutos(data.minutosAtraso)} de atraso. Este tempo será acrescido à sua jornada.`);
      } else {
        toast.success('Almoço finalizado, bom trabalho!');
      }
    },
    onError: (error) => {
      console.error('[useJornadaTrabalho] Erro ao finalizar almoço:', error);
      toast.error('Erro ao finalizar almoço');
    }
  });

  // Mutation para encerrar turno
  const encerrarTurnoMutation = useMutation({
    mutationFn: async () => {
      if (!turno?.id) throw new Error('Turno não encontrado');

      const { data, error } = await supabase
        .from('turnos_profissionais')
        .update({
          status: 'encerrado',
          fim_turno: new Date().toISOString()
        })
        .eq('id', turno.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      refetchTurno();
      
      const extras = data.minutos_extras || 0;
      const faltantes = data.minutos_faltantes || 0;
      
      if (extras > 0) {
        toast.success(`Turno encerrado! Você acumulou ${formatarMinutos(extras)} de banco de horas`);
      } else if (faltantes > 0) {
        toast.warning(`Turno encerrado. Você ficou devendo ${formatarMinutos(faltantes)}`);
      } else {
        toast.success('Turno encerrado com sucesso!');
      }
    },
    onError: (error) => {
      console.error('[useJornadaTrabalho] Erro ao encerrar turno:', error);
      toast.error('Erro ao encerrar turno');
    }
  });

  // Verificar se deve iniciar almoço automaticamente
  useEffect(() => {
    if (
      turno?.status === 'ativo' &&
      !turno.inicio_almoco &&
      tempoReal.minutosTrabalhados >= TEMPO_ATE_ALMOCO_MINUTOS
    ) {
      console.log('[useJornadaTrabalho] 4 horas trabalhadas - iniciando almoço automaticamente');
      iniciarAlmocoMutation.mutate();
    }
  }, [turno?.status, turno?.inicio_almoco, tempoReal.minutosTrabalhados]);

  // Auto-finalizar almoço quando os 60 minutos se completam
  useEffect(() => {
    if (
      turno?.status === 'em_almoco' &&
      tempoReal.minutosAlmoco >= DURACAO_ALMOCO_MINUTOS &&
      !finalizarAlmocoMutation.isPending
    ) {
      console.log('[useJornadaTrabalho] Almoço de 60min completo - finalizando automaticamente');
      finalizarAlmocoMutation.mutate();
    }
  }, [turno?.status, tempoReal.minutosAlmoco]);

  // Calcular atraso de almoço em tempo real
  const calcularAtrasoAlmocoAtual = (): number => {
    if (turno?.status !== 'em_almoco' || !turno?.inicio_almoco) {
      return turno?.minutos_atraso_almoco || 0;
    }
    // Se ainda está em almoço, calcular atraso em tempo real
    return Math.max(0, tempoReal.minutosAlmoco - DURACAO_ALMOCO_MINUTOS);
  };

  const minutosAtrasoAlmoco = calcularAtrasoAlmocoAtual();
  const emAtrasoAlmoco = turno?.status === 'em_almoco' && tempoReal.minutosAlmoco > DURACAO_ALMOCO_MINUTOS;

  // Calcular estado da jornada
  // A jornada é ajustada pelo saldo anterior E pelo atraso de almoço (se houver)
  // Usar atraso em tempo real se ainda em almoço, senão usar registrado
  const atrasoEfetivo = turno?.status === 'em_almoco' ? minutosAtrasoAlmoco : (turno?.minutos_atraso_almoco || 0);
  const jornadaBase = JORNADA_PADRAO_MINUTOS - (saldoAnterior || 0);
  const jornadaAjustada = jornadaBase + atrasoEfetivo; // Atraso AUMENTA a jornada
  
  const minutosRestantes = Math.max(0, jornadaAjustada - tempoReal.minutosTrabalhados);
  const percentualJornada = jornadaAjustada > 0 ? Math.min(100, (tempoReal.minutosTrabalhados / jornadaAjustada) * 100) : 0;
  const minutosAlmocoRestantes = Math.max(0, DURACAO_ALMOCO_MINUTOS - tempoReal.minutosAlmoco);
  const deveIniciarAlmoco = turno?.status === 'ativo' && !turno?.inicio_almoco && tempoReal.minutosTrabalhados >= TEMPO_ATE_ALMOCO_MINUTOS;

  // Verificar se deve encerrar turno automaticamente quando jornada está completa
  useEffect(() => {
    if (
      turno?.status === 'ativo' &&
      tempoReal.minutosTrabalhados > 0 &&
      minutosRestantes === 0
    ) {
      console.log('[useJornadaTrabalho] Jornada completa - encerrando turno automaticamente');
      encerrarTurnoMutation.mutate();
    }
  }, [turno?.status, tempoReal.minutosTrabalhados, minutosRestantes, turno?.id]);
  const getStatus = (): JornadaState['status'] => {
    if (!turno || !turno.inicio_turno) return 'inativo';
    if (turno.status === 'encerrado') return 'encerrado';
    if (turno.status === 'em_almoco') return 'almoco';
    return 'trabalhando';
  };

  const jornadaState: JornadaState = {
    turno,
    minutosTrabalhados: tempoReal.minutosTrabalhados,
    minutosRestantes,
    percentualJornada,
    emAlmoco: turno?.status === 'em_almoco',
    minutosAlmoco: tempoReal.minutosAlmoco,
    minutosAlmocoRestantes,
    deveIniciarAlmoco,
    minutosAtrasoAlmoco,
    emAtrasoAlmoco,
    saldoAnterior: saldoAnterior || 0,
    jornadaAjustada,
    status: getStatus()
  };

  return {
    ...jornadaState,
    isLoading,
    
    // Ações
    iniciarTurno: iniciarTurnoMutation.mutate,
    iniciarAlmoco: iniciarAlmocoMutation.mutate,
    finalizarAlmoco: finalizarAlmocoMutation.mutate,
    encerrarTurno: encerrarTurnoMutation.mutate,
    refetchTurno,
    
    // Estados de loading
    isIniciandoTurno: iniciarTurnoMutation.isPending,
    isIniciandoAlmoco: iniciarAlmocoMutation.isPending,
    isFinalizandoAlmoco: finalizarAlmocoMutation.isPending,
    isEncerrando: encerrarTurnoMutation.isPending,
    
    // Helpers
    formatarMinutos,
    getTempoFormatado: () => formatarTempoJornada(tempoReal.minutosTrabalhados, minutosRestantes)
  };
}

// Helpers de formatação
export function formatarMinutos(minutos: number): string {
  const horas = Math.floor(Math.abs(minutos) / 60);
  const mins = Math.abs(minutos) % 60;
  
  if (horas === 0) {
    return `${mins}min`;
  }
  
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

export function formatarTempoJornada(trabalhados: number, restantes: number): string {
  return `${formatarMinutos(trabalhados)} trabalhadas | ${formatarMinutos(restantes)} restantes`;
}
