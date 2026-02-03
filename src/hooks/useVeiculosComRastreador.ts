import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VeiculoComRastreador {
  rastreador_id: string;
  placa: string;
  marca: string;
  modelo: string;
  latitude: number | null;
  longitude: number | null;
  ignicao: boolean | null;
  velocidade: number | null;
  ultima_comunicacao: string | null;
  status_comunicacao: string;
  horas_sem_comunicacao: number;
}

/**
 * Hook para buscar veículos com rastreador de um associado específico
 * usando a view view_rastreadores_posicao (mesma do Monitoramento)
 */
export function useVeiculosComRastreador(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['veiculos-com-rastreador', associadoId],
    queryFn: async () => {
      if (!associadoId) return [];
      
      const { data, error } = await supabase
        .from('view_rastreadores_posicao')
        .select('*')
        .eq('associado_id', associadoId);
      
      if (error) throw error;
      
      // Mapear para interface tipada
      return (data || []).map(row => ({
        rastreador_id: row.rastreador_id,
        placa: row.placa,
        marca: row.marca,
        modelo: row.modelo,
        latitude: row.latitude,
        longitude: row.longitude,
        ignicao: row.ignicao,
        velocidade: row.velocidade,
        ultima_comunicacao: row.ultima_comunicacao,
        status_comunicacao: row.status_comunicacao,
        horas_sem_comunicacao: row.horas_sem_comunicacao,
      })) as VeiculoComRastreador[];
    },
    enabled: !!associadoId,
  });
}

// Helper para obter classe CSS baseada no status de comunicação
export function getStatusComunicacaoBadgeClass(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'atencao':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'offline':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Helper para obter label do status
export function getStatusComunicacaoLabel(status: string): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'atencao':
      return 'Atenção';
    case 'offline':
      return 'Offline';
    default:
      return 'Sem dados';
  }
}
