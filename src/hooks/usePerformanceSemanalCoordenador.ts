import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { getHojeBrasilia } from '@/lib/date-utils';

export interface PerformanceDia {
  dia: string;
  vistorias: number;
  instalacoes: number;
}

export function usePerformanceSemanalCoordenador() {
  return useQuery({
    queryKey: ['performance-semanal-coordenador'],
    queryFn: async (): Promise<PerformanceDia[]> => {
      const hoje = getHojeBrasilia();
      const seteDiasAtras = subDays(hoje, 6);
      seteDiasAtras.setHours(0, 0, 0, 0);

      // Buscar vistorias concluídas nos últimos 7 dias
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select('concluida_em')
        .in('status', ['aprovada', 'reprovada'])
        .not('concluida_em', 'is', null)
        .gte('concluida_em', seteDiasAtras.toISOString());

      // Buscar instalações concluídas nos últimos 7 dias
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('concluida_em')
        .eq('status', 'concluida')
        .not('concluida_em', 'is', null)
        .gte('concluida_em', seteDiasAtras.toISOString());

      // Inicializar mapa dos últimos 7 dias
      const diasMap = new Map<string, { vistorias: number; instalacoes: number }>();
      for (let i = 6; i >= 0; i--) {
        const dia = subDays(hoje, i);
        const diaStr = format(dia, 'dd/MM');
        diasMap.set(diaStr, { vistorias: 0, instalacoes: 0 });
      }

      // Contar vistorias por dia
      vistorias?.forEach(v => {
        if (v.concluida_em) {
          const diaStr = format(new Date(v.concluida_em), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) diasMap.set(diaStr, { ...atual, vistorias: atual.vistorias + 1 });
        }
      });

      // Contar instalações por dia
      instalacoes?.forEach(i => {
        if (i.concluida_em) {
          const diaStr = format(new Date(i.concluida_em), 'dd/MM');
          const atual = diasMap.get(diaStr);
          if (atual) diasMap.set(diaStr, { ...atual, instalacoes: atual.instalacoes + 1 });
        }
      });

      return Array.from(diasMap.entries()).map(([dia, dados]) => ({
        dia,
        ...dados
      }));
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
