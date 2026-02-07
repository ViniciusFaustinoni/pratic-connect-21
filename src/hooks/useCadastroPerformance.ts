import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';

interface PerformanceData {
  dia: string;
  aprovados: number;
  reprovados: number;
}

/**
 * Hook para buscar performance do analista de cadastro
 * Retorna propostas aprovadas/reprovadas por dia nos últimos 7 dias
 */
export function useCadastroPerformance() {
  return useQuery({
    queryKey: ['cadastro-performance'],
    queryFn: async (): Promise<PerformanceData[]> => {
      const hoje = getHojeBrasilia();
      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(hoje.getDate() - 6); // -6 para incluir hoje = 7 dias
      seteDiasAtras.setHours(0, 0, 0, 0);
      
      // Buscar aprovados (status ativo com data_ativacao nos últimos 7 dias)
      const { data: aprovados } = await supabase
        .from('contratos')
        .select('data_ativacao')
        .eq('status', 'ativo')
        .not('data_ativacao', 'is', null)
        .gte('data_ativacao', seteDiasAtras.toISOString());
      
      // Buscar reprovados (status cancelado com updated_at nos últimos 7 dias)
      const { data: reprovados } = await supabase
        .from('contratos')
        .select('updated_at')
        .eq('status', 'cancelado')
        .gte('updated_at', seteDiasAtras.toISOString());
      
      // Inicializar mapa dos últimos 7 dias
      const diasMap = new Map<string, { aprovados: number; reprovados: number }>();
      
      for (let i = 6; i >= 0; i--) {
        const dia = new Date(hoje);
        dia.setDate(hoje.getDate() - i);
        const diaStr = format(dia, 'dd/MM');
        diasMap.set(diaStr, { aprovados: 0, reprovados: 0 });
      }
      
      // Contar aprovados por dia
      aprovados?.forEach(c => {
        if (c.data_ativacao) {
          const diaStr = format(new Date(c.data_ativacao), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) {
            diasMap.set(diaStr, { ...atual, aprovados: atual.aprovados + 1 });
          }
        }
      });
      
      // Contar reprovados por dia
      reprovados?.forEach(c => {
        if (c.updated_at) {
          const diaStr = format(new Date(c.updated_at), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) {
            diasMap.set(diaStr, { ...atual, reprovados: atual.reprovados + 1 });
          }
        }
      });
      
      return Array.from(diasMap.entries()).map(([dia, dados]) => ({
        dia,
        ...dados
      }));
    },
    staleTime: 60000, // 1 minuto
  });
}
