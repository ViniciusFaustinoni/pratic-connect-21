import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PortadorMetrica {
  id: string;
  nome: string;
  quantidade: number;
}

export interface RastreadoresPorPortadorMetricas {
  porPortador: PortadorMetrica[];
  totalEmPorte: number;
  semPortador: number;
}

/**
 * Hook para buscar métricas de rastreadores agrupados por portador
 * Retorna a distribuição de rastreadores em estoque entre os profissionais
 */
export function useRastreadoresPorPortador() {
  return useQuery({
    queryKey: ['rastreadores-por-portador'],
    queryFn: async (): Promise<RastreadoresPorPortadorMetricas> => {
      // Buscar rastreadores em estoque com dados do portador
      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          portador_id,
          portador:profiles!rastreadores_portador_id_fkey(id, nome)
        `)
        .eq('status', 'estoque');

      if (error) throw error;

      // Agrupar por portador
      const agrupado: Record<string, { id: string; nome: string; quantidade: number }> = {};
      let semPortador = 0;

      (data || []).forEach((r: any) => {
        if (r.portador_id && r.portador) {
          const id = r.portador_id;
          const nome = r.portador.nome || 'Sem nome';
          if (!agrupado[id]) {
            agrupado[id] = { id, nome, quantidade: 0 };
          }
          agrupado[id].quantidade++;
        } else {
          semPortador++;
        }
      });

      const porPortador = Object.values(agrupado)
        .sort((a, b) => b.quantidade - a.quantidade);

      return {
        porPortador,
        totalEmPorte: (data?.length || 0) - semPortador,
        semPortador,
      };
    },
    refetchInterval: 60000, // Atualiza a cada minuto
  });
}
