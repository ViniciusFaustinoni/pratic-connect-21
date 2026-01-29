import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface StatusClienteResponse {
  success: boolean;
  sincronizado: boolean;
  statusLocal: string;
  statusPlataforma?: string | null;
  dados: {
    idCliente?: number | null;
    statusPlataforma: string | null;
    dataUltimaAtualizacao?: string | null;
    veiculosVinculados: number;
    veiculosAtivos: number;
    veiculosInativos: number;
    adimplente: boolean | null;
  };
  erro?: string;
}

export interface StatusVeiculoResponse {
  success: boolean;
  sincronizado: boolean;
  statusLocal: string;
  statusPlataforma?: string | null;
  dados: {
    idVeiculo?: number | null;
    statusPlataforma: string | null;
    adimplente: boolean | null;
    ultimaPosicao?: {
      latitude: number;
      longitude: number;
      dataHora: string;
    } | null;
    rastreadorAtivo: boolean;
    ultimaComunicacao?: string | null;
    ignicao?: boolean | null;
    velocidade?: number | null;
  };
  erro?: string;
}

export interface SincronizacaoResult {
  success: boolean;
  associadoId: string;
  diferencasEncontradas: {
    tipo: 'associado' | 'veiculo';
    id: string;
    statusLocal: string;
    statusPlataforma: string;
    atualizado: boolean;
  }[];
  veiculosSincronizados: number;
  erros: string[];
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook para consultar status do cliente na Rede Veículos
 * Consulta em tempo real a plataforma e compara com status local
 */
export function useStatusClienteRedeVeiculos(associadoId: string | undefined) {
  return useQuery<StatusClienteResponse>({
    queryKey: ['rede-veiculos-status-cliente', associadoId],
    enabled: !!associadoId,
    staleTime: 30000, // 30 segundos - consultar novamente após esse tempo
    gcTime: 60000, // 1 minuto no cache
    retry: 1, // Tentar apenas 1 vez em caso de erro
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'rede-veiculos-obter-status-cliente',
        { body: { associadoId } }
      );
      
      if (error) {
        console.error('[useStatusClienteRedeVeiculos] Erro:', error);
        throw error;
      }
      
      return data as StatusClienteResponse;
    },
  });
}

/**
 * Hook para consultar status de um veículo específico na Rede Veículos
 */
export function useStatusVeiculoRedeVeiculos(veiculoId: string | undefined) {
  return useQuery<StatusVeiculoResponse>({
    queryKey: ['rede-veiculos-status-veiculo', veiculoId],
    enabled: !!veiculoId,
    staleTime: 30000,
    gcTime: 60000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'rede-veiculos-obter-status-veiculo',
        { body: { veiculoId } }
      );
      
      if (error) {
        console.error('[useStatusVeiculoRedeVeiculos] Erro:', error);
        throw error;
      }
      
      return data as StatusVeiculoResponse;
    },
  });
}

/**
 * Hook para sincronizar status com a plataforma Rede Veículos
 */
export function useSincronizarStatusRedeVeiculos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      associadoId, 
      forcarAtualizacao = false 
    }: { 
      associadoId: string; 
      forcarAtualizacao?: boolean;
    }): Promise<SincronizacaoResult> => {
      const { data, error } = await supabase.functions.invoke(
        'rede-veiculos-sincronizar-status',
        { body: { associadoId, forcarAtualizacao } }
      );
      
      if (error) {
        console.error('[useSincronizarStatusRedeVeiculos] Erro:', error);
        throw error;
      }
      
      return data as SincronizacaoResult;
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['rede-veiculos-status-cliente', variables.associadoId] });
      queryClient.invalidateQueries({ queryKey: ['associado', variables.associadoId] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-associado', variables.associadoId] });
      
      // Notificação de sucesso
      if (data.diferencasEncontradas.length === 0) {
        toast.success('Status sincronizado', {
          description: `${data.veiculosSincronizados} veículo(s) verificado(s). Tudo em sincronia!`,
        });
      } else if (data.diferencasEncontradas.some(d => d.atualizado)) {
        toast.warning('Status atualizado', {
          description: `${data.diferencasEncontradas.length} diferença(s) encontrada(s) e corrigida(s).`,
        });
      } else {
        toast.info('Diferenças encontradas', {
          description: `${data.diferencasEncontradas.length} diferença(s) entre status local e plataforma.`,
        });
      }

      // Se houve erros
      if (data.erros.length > 0) {
        toast.error('Erros na sincronização', {
          description: data.erros[0],
        });
      }
    },
    onError: (error) => {
      console.error('[useSincronizarStatusRedeVeiculos] Erro:', error);
      toast.error('Erro ao sincronizar', {
        description: 'Não foi possível sincronizar com a plataforma. Tente novamente.',
      });
    },
  });
}

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Retorna cor do badge baseado no status de sincronização
 */
export function getStatusSincronizacaoCor(sincronizado: boolean, statusPlataforma: string | null | undefined): string {
  if (statusPlataforma === null || statusPlataforma === undefined) {
    return 'bg-gray-100 text-gray-800 border-gray-200'; // Não vinculado
  }
  
  if (!sincronizado) {
    return 'bg-red-100 text-red-800 border-red-200'; // Dessincronizado
  }
  
  if (statusPlataforma === 'ativo') {
    return 'bg-green-100 text-green-800 border-green-200';
  }
  
  if (statusPlataforma === 'inativo') {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  
  if (statusPlataforma === 'inadimplente') {
    return 'bg-orange-100 text-orange-800 border-orange-200';
  }
  
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Retorna label do status na plataforma
 */
export function getStatusPlataformaLabel(status: string | null | undefined): string {
  if (!status) return 'Não vinculado';
  
  const labels: Record<string, string> = {
    ativo: 'Ativo na Plataforma',
    inativo: 'Inativo na Plataforma',
    inadimplente: 'Inadimplente',
    parcial: 'Parcialmente Ativo',
    sem_veiculos: 'Sem Veículos',
    desconhecido: 'Status Desconhecido',
  };
  
  return labels[status] || status;
}
