import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TarefaAtual } from './useServicos';
import { useAuth } from '@/contexts/AuthContext';
import { backgroundLocationService } from '@/services/backgroundLocationService';
import { format } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';
import { calcularDistanciaMetros } from '@/hooks/useBasesPratic';

interface IniciarServicoResult {
  resultado: 'atribuida' | 'ja_tem_tarefa' | 'sem_tarefas';
  tarefa?: TarefaAtual;
  mensagem?: string;
}

interface GeolocationState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  error?: string;
}

// Intervalo de atualização de localização (5 minutos)
const LOCATION_UPDATE_INTERVAL = 5 * 60 * 1000;

// Intervalo de polling para buscar novas tarefas (2 minutos)
const TASK_POLLING_INTERVAL = 2 * 60 * 1000;

/**
 * Hook para gerenciar o fluxo de iniciar serviço com geolocalização
 * Também mantém localização atualizada em background para sistema de encaixe automático
 * 
 * ATUALIZADO: Agora usa a tabela servicos unificada
 */
export function useIniciarServico() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [geoState, setGeoState] = useState<GeolocationState>({ status: 'idle' });
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Query para verificar se o profissional está em serviço
  const { data: statusEmServico, refetch: refetchStatus } = useQuery({
    queryKey: ['profissional-em-servico', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return false;
      
      const { data, error } = await supabase
        .from('vistoriadores_localizacao')
        .select('em_servico')
        .eq('vistoriador_id', profile.id)
        .maybeSingle();
      
      if (error) {
        console.error('[useIniciarServico] Erro ao verificar status:', error);
        return false;
      }
      
      return data?.em_servico || false;
    },
    enabled: !!profile?.id,
    staleTime: 30000,
  });

  const emServico = statusEmServico || false;

  // Mutation para chamar a edge function (que agora usa tabela servicos)
  const atribuirTarefaMutation = useMutation({
    mutationFn: async ({ latitude, longitude }: { latitude: number; longitude: number }): Promise<IniciarServicoResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Usuário não autenticado');
      }

      const response = await supabase.functions.invoke('atribuir-proxima-tarefa', {
        body: { latitude, longitude, acao: 'iniciar' },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao buscar tarefa');
      }

      return response.data as IniciarServicoResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      refetchStatus();
      
      if (data.resultado === 'atribuida') {
        toast.success('Nova tarefa atribuída!');
      } else if (data.resultado === 'ja_tem_tarefa') {
        toast.info('Você já tem uma tarefa em andamento');
      } else if (data.resultado === 'sem_tarefas') {
        toast.success(data.mensagem || 'Você está ativo para receber serviços');
      }
    },
    onError: (error) => {
      console.error('Erro ao atribuir tarefa:', error);
      toast.error('Erro ao buscar tarefa próxima');
    }
  });

  // Função para enviar localização para o banco (silenciosa, sem toasts)
  const enviarLocalizacao = useCallback(async (
    latitude: number, 
    longitude: number,
    marcarEmServico: boolean = true
  ) => {
    if (!profile?.id) return;

    try {
      await supabase
        .from('vistoriadores_localizacao')
        .upsert({
          vistoriador_id: profile.id,
          latitude,
          longitude,
          em_servico: marcarEmServico,
          updated_at: new Date().toISOString()
        }, { onConflict: 'vistoriador_id' });

      console.log(`[useIniciarServico] Localização atualizada: (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) em_servico: ${marcarEmServico}`);
    } catch (error) {
      console.error('[useIniciarServico] Erro ao enviar localização:', error);
    }
  }, [profile?.id]);

  // Iniciar tracking contínuo de localização
  const iniciarTrackingLocalizacao = useCallback(() => {
    if (!navigator.geolocation || !profile?.id) return;

    // Limpar tracking anterior
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }

    // Usar watchPosition para tracking contínuo
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGeoState(prev => ({
          ...prev,
          status: 'granted',
          latitude,
          longitude,
          accuracy,
          error: undefined
        }));
      },
      (error) => {
        console.warn('[useIniciarServico] Erro no watchPosition:', error.message);
        
        if (error.code === 1) { // PERMISSION_DENIED
          setGeoState({
            status: 'denied',
            error: 'Permissão de localização revogada. Ative a localização nas configurações.'
          });
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          setGeoState({
            status: 'unavailable',
            error: 'GPS desativado ou indisponível. Verifique se o GPS está ativo.'
          });
        } else if (error.code === 3) { // TIMEOUT
          console.warn('[useIniciarServico] Timeout no watchPosition, continuando...');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000
      }
    );

    // Enviar localização periodicamente (a cada 5 minutos)
    locationIntervalRef.current = setInterval(async () => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        await enviarLocalizacao(position.coords.latitude, position.coords.longitude, true);
      } catch (error) {
        console.warn('[useIniciarServico] Erro ao atualizar localização periódica:', error);
      }
    }, LOCATION_UPDATE_INTERVAL);

    // Enviar localização inicial imediatamente
    navigator.geolocation.getCurrentPosition(
      (position) => {
        enviarLocalizacao(position.coords.latitude, position.coords.longitude, true);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );

    console.log('[useIniciarServico] Tracking de localização iniciado');
  }, [profile?.id, enviarLocalizacao]);

  // Parar tracking de localização
  const pararTrackingLocalizacao = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    console.log('[useIniciarServico] Tracking de localização parado');
  }, []);

  // Iniciar tracking quando o hook é montado e o usuário está logado E em serviço
  useEffect(() => {
    if (profile?.id && emServico) {
      const timer = setTimeout(() => {
        iniciarTrackingLocalizacao();
      }, 2000);

      return () => {
        clearTimeout(timer);
        pararTrackingLocalizacao();
      };
    }
  }, [profile?.id, emServico, iniciarTrackingLocalizacao, pararTrackingLocalizacao]);

  // Polling automático para buscar novas tarefas quando em serviço sem tarefa
  useEffect(() => {
    if (!profile?.id || !emServico) return;

    console.log('[useIniciarServico] Polling iniciado - profissional em serviço');

    // Função auxiliar para obter localização atual
    const obterLocalizacaoAtual = async (): Promise<{ lat: number; lng: number } | null> => {
      // Primeiro tentar usar do state
      if (geoState.latitude && geoState.longitude) {
        return { lat: geoState.latitude, lng: geoState.longitude };
      }

      // Se não tem no state, tentar obter agora
      if (!navigator.geolocation) return null;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          });
        });
        return { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch (e) {
        console.warn('[useIniciarServico] Não foi possível obter localização para polling:', e);
        return null;
      }
    };

    // Verificar se já tem tarefa e tentar atribuir nova
    const checkAndAssignTask = async () => {
      console.log('[useIniciarServico] Polling: Verificando tarefas...');
      
      // Verificar se há tarefa atual
      const { data: tarefaAtual, error } = await supabase
        .rpc('buscar_tarefa_atual_profissional', { p_profissional_id: profile.id });

      if (error) {
        console.error('[useIniciarServico] Erro ao buscar tarefa atual:', error);
        return;
      }

      // CORREÇÃO: Verificar array vazio corretamente
      // [] é truthy em JavaScript, então ![] é false
      const temTarefa = Array.isArray(tarefaAtual) 
        ? tarefaAtual.length > 0 
        : !!tarefaAtual;

      console.log('[useIniciarServico] Polling: temTarefa =', temTarefa, 'tarefaAtual =', tarefaAtual);

      // Se não tem tarefa e está em serviço, tentar atribuir
      if (!temTarefa) {
        const coords = await obterLocalizacaoAtual();
        
        if (!coords) {
          console.warn('[useIniciarServico] Polling: Sem localização disponível');
          return;
        }

        console.log('[useIniciarServico] Polling: Buscando nova tarefa com coords:', coords);
        
        try {
          const response = await supabase.functions.invoke('atribuir-proxima-tarefa', {
            body: { latitude: coords.lat, longitude: coords.lng, acao: 'polling' },
          });

          console.log('[useIniciarServico] Polling: Resposta:', response.data);

          if (response.data?.resultado === 'atribuida') {
            console.log('[useIniciarServico] Polling: Nova tarefa atribuída!');
            queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
            queryClient.invalidateQueries({ queryKey: ['servicos'] });
            toast.success('Nova tarefa atribuída!');
          }
        } catch (error) {
          console.warn('[useIniciarServico] Erro no polling:', error);
        }
      }
    };

    // Executar imediatamente
    checkAndAssignTask();

    // Polling a cada 2 minutos
    const pollingInterval = setInterval(checkAndAssignTask, TASK_POLLING_INTERVAL);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [profile?.id, emServico, queryClient]);

  // Função para solicitar localização e iniciar serviço
  const iniciarServico = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoState({ status: 'unavailable', error: 'Geolocalização não disponível neste dispositivo' });
      toast.error('Geolocalização não disponível');
      return;
    }

    setGeoState({ status: 'requesting' });

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 45000,
            maximumAge: 0
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;
      
      setGeoState({ 
        status: 'granted', 
        latitude, 
        longitude, 
        accuracy 
      });

      console.log(`[useIniciarServico] Localização obtida: (${latitude}, ${longitude}) precisão: ${accuracy}m`);

      // Verificar alocação do dia para validação de proximidade da base
      if (profile?.id) {
        const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');
        
        const { data: alocacao } = await supabase
          .from('alocacoes_diarias')
          .select('tipo_alocacao')
          .eq('profissional_id', profile.id)
          .eq('data', hoje)
          .maybeSingle();

        if (alocacao?.tipo_alocacao === 'base') {
          // Vistoriador em BASE — validar proximidade com oficina base
          const { data: bases } = await supabase
            .from('oficinas')
            .select('id, razao_social, nome_fantasia, latitude, longitude')
            .eq('is_base_pratic', true)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);

          if (!bases || bases.length === 0) {
            toast.error('Nenhuma base cadastrada no sistema. Contate o coordenador.');
            return;
          }

          // Verificar se está próximo de alguma base (200m)
          const DISTANCIA_MAXIMA = 200;
          let baseProxima = false;
          let menorDistancia = Infinity;

          for (const base of bases) {
            const dist = calcularDistanciaMetros(latitude, longitude, base.latitude!, base.longitude!);
            if (dist < menorDistancia) menorDistancia = dist;
            if (dist <= DISTANCIA_MAXIMA) {
              baseProxima = true;
              console.log(`[useIniciarServico] Base próxima: ${base.nome_fantasia || base.razao_social} (${Math.round(dist)}m)`);
              break;
            }
          }

          if (!baseProxima) {
            toast.error(`Aproxime-se da base para registrar ponto (distância: ${Math.round(menorDistancia)}m, máximo: ${DISTANCIA_MAXIMA}m)`);
            setGeoState({ status: 'idle' });
            return;
          }
        }
      }

      // PRIMEIRO: Criar turno imediatamente ao ativar localização
      // A jornada começa AGORA, independente de tarefa atribuída
      // IMPORTANTE: Se já existe turno hoje, NÃO sobrescrever inicio_turno
      if (profile?.id) {
        try {
          const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');
          
          // Verificar se já existe turno para hoje
          const { data: turnoExistente } = await supabase
            .from('turnos_profissionais')
            .select('id, inicio_turno, status')
            .eq('profissional_id', profile.id)
            .eq('data', hoje)
            .maybeSingle();

          if (turnoExistente?.inicio_turno) {
            // Turno já existe - apenas reativar se estava encerrado
            if (turnoExistente.status === 'encerrado') {
              await supabase
                .from('turnos_profissionais')
                .update({ status: 'ativo', fim_turno: null })
                .eq('id', turnoExistente.id);
              console.log('[useIniciarServico] Turno reativado (mantendo inicio_turno original)');
            } else {
              console.log('[useIniciarServico] Turno já existe e está ativo - mantendo inicio_turno original');
            }
          } else {
            // Turno não existe - criar novo
            // Buscar saldo do dia anterior
            const { data: turnoAnterior } = await supabase
              .from('turnos_profissionais')
              .select('minutos_extras, minutos_faltantes')
              .eq('profissional_id', profile.id)
              .lt('data', hoje)
              .order('data', { ascending: false })
              .limit(1)
              .maybeSingle();

            const saldoAnterior = turnoAnterior 
              ? (turnoAnterior.minutos_extras || 0) - (turnoAnterior.minutos_faltantes || 0) 
              : 0;

            await supabase
              .from('turnos_profissionais')
              .insert({
                profissional_id: profile.id,
                data: hoje,
                inicio_turno: new Date().toISOString(),
                status: 'ativo',
                saldo_anterior_minutos: saldoAnterior,
              });

            console.log('[useIniciarServico] Novo turno criado - jornada iniciada a partir da ativação de localização');
          }
          
          queryClient.invalidateQueries({ queryKey: ['turno-profissional'] });
          queryClient.invalidateQueries({ queryKey: ['jornadas-profissionais'] });
        } catch (turnoError) {
          console.error('[useIniciarServico] Erro ao criar turno automático:', turnoError);
        }
      }

      // DEPOIS: Chamar a edge function para atribuir tarefa (não bloqueia a contagem de jornada)
      await atribuirTarefaMutation.mutateAsync({ latitude, longitude });

      // Verificar se está em plataforma nativa para usar background location
      if (backgroundLocationService.isNativePlatform() && profile?.id) {
        console.log('[useIniciarServico] Plataforma nativa detectada - iniciando background location');
        const backgroundStarted = await backgroundLocationService.iniciar(profile.id);
        
        if (backgroundStarted) {
          console.log('[useIniciarServico] Background location ativado com sucesso');
          toast.success('Rastreamento em segundo plano ativado');
        } else {
          console.warn('[useIniciarServico] Falha ao iniciar background location, usando fallback web');
          iniciarTrackingLocalizacao();
        }
      } else {
        // PWA: usar watchPosition (funciona apenas com app aberto)
        console.log('[useIniciarServico] Usando geolocation web (PWA)');
        iniciarTrackingLocalizacao();
      }

    } catch (error: any) {
      console.error('[useIniciarServico] Erro de geolocalização:', error);
      
      if (error.code === 1) {
        setGeoState({ 
          status: 'denied', 
          error: 'Permissão de localização negada. Ative a localização nas configurações do seu navegador.' 
        });
        toast.error('Permissão de localização negada. Ative a localização para continuar.');
      } else if (error.code === 2) {
        setGeoState({ 
          status: 'unavailable', 
          error: 'Não foi possível obter sua localização. Verifique se o GPS está ativo.' 
        });
        toast.error('Não foi possível obter sua localização');
      } else if (error.code === 3) {
        setGeoState({ 
          status: 'unavailable', 
          error: 'Tempo esgotado ao obter localização. Verifique sua conexão e tente novamente.' 
        });
        toast.error('Tempo esgotado. Verifique sua conexão e tente novamente.');
      } else {
        setGeoState({ 
          status: 'unavailable', 
          error: error.message || 'Erro desconhecido ao obter localização' 
        });
        toast.error('Erro ao obter localização');
      }
    }
  }, [atribuirTarefaMutation, iniciarTrackingLocalizacao, profile?.id]);

  // Função para encerrar o turno
  const encerrarServico = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Parar rastreamento (nativo ou web)
      if (backgroundLocationService.isNativePlatform()) {
        console.log('[useIniciarServico] Parando background location nativo');
        await backgroundLocationService.parar();
      } else {
        pararTrackingLocalizacao();
      }

      await supabase
        .from('vistoriadores_localizacao')
        .update({ 
          em_servico: false,
          updated_at: new Date().toISOString()
        })
        .eq('vistoriador_id', profile.id);

      // Encerrar turno ativo do dia
      try {
        const hoje = format(getHojeBrasilia(), 'yyyy-MM-dd');
        await supabase
          .from('turnos_profissionais')
          .update({ 
            status: 'encerrado', 
            fim_turno: new Date().toISOString() 
          })
          .eq('profissional_id', profile.id)
          .eq('data', hoje)
          .neq('status', 'encerrado');

        console.log('[useIniciarServico] Turno encerrado automaticamente');
        queryClient.invalidateQueries({ queryKey: ['turno-profissional'] });
        queryClient.invalidateQueries({ queryKey: ['jornadas-profissionais'] });
      } catch (turnoError) {
        console.error('[useIniciarServico] Erro ao encerrar turno:', turnoError);
      }

      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      
      toast.success('Turno encerrado com sucesso');
    } catch (error) {
      console.error('[useIniciarServico] Erro ao encerrar serviço:', error);
      toast.error('Erro ao encerrar turno');
    }
  }, [profile?.id, pararTrackingLocalizacao, queryClient, refetchStatus]);

  // Função para atualizar localização (usada após concluir tarefa)
  const atualizarLocalizacao = useCallback(async () => {
    if (!navigator.geolocation) return null;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      if (profile?.id) {
        await enviarLocalizacao(position.coords.latitude, position.coords.longitude, true);
      }

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
      return null;
    }
  }, [profile?.id, enviarLocalizacao]);

  // Função para buscar próxima tarefa após concluir uma
  const buscarProximaTarefa = useCallback(async () => {
    const coords = await atualizarLocalizacao();
    if (coords) {
      await atribuirTarefaMutation.mutateAsync(coords);
    } else {
      toast.error('Ative a localização para buscar a próxima tarefa');
    }
  }, [atualizarLocalizacao, atribuirTarefaMutation]);

  return {
    iniciarServico,
    encerrarServico,
    buscarProximaTarefa,
    atualizarLocalizacao,
    geoState,
    emServico,
    isLoading: atribuirTarefaMutation.isPending || geoState.status === 'requesting',
    resultado: atribuirTarefaMutation.data,
    error: atribuirTarefaMutation.error,
  };
}
