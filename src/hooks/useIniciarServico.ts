import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TarefaAtual } from './useTarefaAtual';
import { useAuth } from '@/contexts/AuthContext';

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

/**
 * Hook para gerenciar o fluxo de iniciar serviço com geolocalização
 * Também mantém localização atualizada em background para sistema de encaixe automático
 */
export function useIniciarServico() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [geoState, setGeoState] = useState<GeolocationState>({ status: 'idle' });
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Query para verificar se o vistoriador está em serviço
  const { data: statusEmServico, refetch: refetchStatus } = useQuery({
    queryKey: ['vistoriador-em-servico', profile?.id],
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

  // Mutation para chamar a edge function
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
        
        // Atualizar estado para refletir perda de permissão/GPS
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
        maximumAge: 60000 // Cache de 1 minuto
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
      // Delay para não bloquear a renderização inicial
      const timer = setTimeout(() => {
        iniciarTrackingLocalizacao();
      }, 2000);

      return () => {
        clearTimeout(timer);
        pararTrackingLocalizacao();
      };
    }
  }, [profile?.id, emServico, iniciarTrackingLocalizacao, pararTrackingLocalizacao]);

  // Função para solicitar localização e iniciar serviço
  const iniciarServico = useCallback(async () => {
    // Verificar se geolocalização está disponível
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
            timeout: 45000, // 45 segundos para conexões mais lentas
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

      // Chamar a edge function para atribuir tarefa
      await atribuirTarefaMutation.mutateAsync({ latitude, longitude });

      // Iniciar tracking após sucesso
      iniciarTrackingLocalizacao();

    } catch (error: any) {
      console.error('[useIniciarServico] Erro de geolocalização:', error);
      
      if (error.code === 1) { // PERMISSION_DENIED
        setGeoState({ 
          status: 'denied', 
          error: 'Permissão de localização negada. Ative a localização nas configurações do seu navegador.' 
        });
        toast.error('Permissão de localização negada. Ative a localização para continuar.');
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        setGeoState({ 
          status: 'unavailable', 
          error: 'Não foi possível obter sua localização. Verifique se o GPS está ativo.' 
        });
        toast.error('Não foi possível obter sua localização');
      } else if (error.code === 3) { // TIMEOUT
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
  }, [atribuirTarefaMutation, iniciarTrackingLocalizacao]);

  // Função para encerrar o turno
  const encerrarServico = useCallback(async () => {
    if (!profile?.id) return;

    try {
      await supabase
        .from('vistoriadores_localizacao')
        .update({ 
          em_servico: false,
          updated_at: new Date().toISOString()
        })
        .eq('vistoriador_id', profile.id);

      // Parar tracking de localização
      pararTrackingLocalizacao();
      
      // Atualizar estado
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

      // Também enviar para o banco mantendo em_servico = true
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
