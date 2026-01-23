import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TarefaAtual } from './useTarefaAtual';

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

/**
 * Hook para gerenciar o fluxo de iniciar serviço com geolocalização
 */
export function useIniciarServico() {
  const queryClient = useQueryClient();
  const [geoState, setGeoState] = useState<GeolocationState>({ status: 'idle' });

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
      
      if (data.resultado === 'atribuida') {
        toast.success('Nova tarefa atribuída!');
      } else if (data.resultado === 'ja_tem_tarefa') {
        toast.info('Você já tem uma tarefa em andamento');
      } else if (data.resultado === 'sem_tarefas') {
        toast.info(data.mensagem || 'Não há tarefas disponíveis no momento');
      }
    },
    onError: (error) => {
      console.error('Erro ao atribuir tarefa:', error);
      toast.error('Erro ao buscar tarefa próxima');
    }
  });

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
            timeout: 30000,
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
          error: 'Tempo esgotado ao obter localização. Tente novamente.' 
        });
        toast.error('Tempo esgotado. Tente novamente.');
      } else {
        setGeoState({ 
          status: 'unavailable', 
          error: error.message || 'Erro desconhecido ao obter localização' 
        });
        toast.error('Erro ao obter localização');
      }
    }
  }, [atribuirTarefaMutation]);

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

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
      return null;
    }
  }, []);

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
    buscarProximaTarefa,
    atualizarLocalizacao,
    geoState,
    isLoading: atribuirTarefaMutation.isPending || geoState.status === 'requesting',
    resultado: atribuirTarefaMutation.data,
    error: atribuirTarefaMutation.error,
  };
}
