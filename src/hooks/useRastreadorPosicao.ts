import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Posicao {
  id: string;
  rastreador_id: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  direcao?: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
  dados_extras?: Record<string, unknown>;
}

export interface PosicaoAtual {
  rastreador_id: string;
  codigo: string;
  placa: string;
  associado_nome: string;
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  horas_sem_comunicacao: number;
  status_comunicacao: 'online' | 'atencao' | 'offline' | 'sem_dados';
}

interface PosicaoTempoRealResponse {
  success: boolean;
  tempo_real: boolean;
  mensagem?: string;
  posicao: {
    latitude: number;
    longitude: number;
    velocidade: number;
    direcao?: number;
    ignicao: boolean;
    data_posicao: string;
    endereco?: string;
    dados_extras?: Record<string, unknown>;
  } | null;
  veiculo: {
    id: string;
    placa: string;
    modelo: string;
    marca?: string;
  } | null;
}

// Hook para buscar última posição de um rastreador (do banco)
export function useRastreadorPosicaoAtual(rastreadorId: string | undefined) {
  return useQuery({
    queryKey: ['rastreador-posicao', rastreadorId],
    queryFn: async () => {
      if (!rastreadorId) return null;

      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          ultima_posicao_lat,
          ultima_posicao_lng,
          ultima_velocidade,
          ultima_ignicao,
          ultima_comunicacao,
          veiculo:veiculos(placa, associado:associados(nome))
        `)
        .eq('id', rastreadorId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId,
    refetchInterval: 30000,
  });
}

// Hook para buscar posição em TEMPO REAL via Edge Function
export function useRastreadorTempoReal(rastreadorId?: string, autoRefresh = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rastreador-tempo-real', rastreadorId],
    queryFn: async (): Promise<PosicaoTempoRealResponse> => {
      if (!rastreadorId) throw new Error('ID não fornecido');

      const { data, error } = await supabase.functions.invoke('rastreador-posicao', {
        body: { rastreador_id: rastreadorId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    enabled: !!rastreadorId,
    refetchInterval: autoRefresh ? 30000 : false,
    staleTime: 15000,
  });

  const atualizarManual = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('rastreador-posicao', {
        body: { rastreador_id: id },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data as PosicaoTempoRealResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['rastreador-tempo-real', rastreadorId], data);

      if (data.tempo_real) {
        toast.success('Posição atualizada!');
      } else {
        toast.info(data.mensagem || 'Exibindo última posição conhecida');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    posicao: query.data?.posicao ?? null,
    veiculo: query.data?.veiculo ?? null,
    tempoReal: query.data?.tempo_real,
    mensagem: query.data?.mensagem,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    atualizarManual,
  };
}

// Hook para buscar histórico de posições
export function useRastreadorHistorico(
  rastreadorId: string | undefined,
  periodo?: { inicio: string; fim: string }
) {
  return useQuery({
    queryKey: ['rastreador-historico', rastreadorId, periodo],
    queryFn: async () => {
      if (!rastreadorId) return [];

      let query = supabase
        .from('rastreador_posicoes')
        .select('*')
        .eq('rastreador_id', rastreadorId)
        .order('data_posicao', { ascending: false })
        .limit(1000);

      if (periodo?.inicio) {
        query = query.gte('data_posicao', periodo.inicio);
      }
      if (periodo?.fim) {
        query = query.lte('data_posicao', periodo.fim);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Posicao[];
    },
    enabled: !!rastreadorId,
  });
}

// Hook para buscar todas as posições atuais (para mapa)
export function useTodasPosicoesAtuais() {
  return useQuery({
    queryKey: ['rastreadores-posicoes-atuais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ultimas_posicoes');

      if (error) throw error;
      return data as PosicaoAtual[];
    },
    refetchInterval: 60000,
  });
}

// Hook para disparar sincronização manual
export function useSyncRastreadores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plataforma?: 'softruck' | 'rede_veiculos') => {
      const { data, error } = await supabase.functions.invoke('sync-rastreadores', {
        body: plataforma ? { plataforma } : {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-posicoes-atuais'] });

      const total = data?.results?.reduce(
        (acc: number, r: { posicoes_atualizadas: number }) => acc + (r.posicoes_atualizadas || 0),
        0
      ) || 0;

      toast.success(`Sincronização concluída: ${total} posições atualizadas`);
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });
}

// Hook para buscar alertas de rastreadores
export function useRastreadorAlertas(rastreadorId?: string) {
  return useQuery({
    queryKey: ['rastreador-alertas', rastreadorId],
    queryFn: async () => {
      let query = supabase
        .from('rastreador_alertas')
        .select(`
          *,
          rastreador:rastreadores(
            codigo,
            veiculo:veiculos(placa, associado:associados(nome))
          )
        `)
        .in('status', ['aberto', 'visualizado'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (rastreadorId) {
        query = query.eq('rastreador_id', rastreadorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

// Hook para contagem de alertas
export function useAlertasContagem() {
  return useQuery({
    queryKey: ['rastreador-alertas-contagem'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_alertas_contagem');

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      return result as {
        abertos: number;
        visualizados: number;
        criticos: number;
        total: number;
      } | null;
    },
    refetchInterval: 30000,
  });
}
