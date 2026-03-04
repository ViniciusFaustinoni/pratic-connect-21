import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, format } from 'date-fns';

interface FiltrosVistoria {
  periodo?: 'hoje' | 'amanha' | 'semana' | 'todas';
  status?: 'agendada' | 'em_andamento' | 'concluida' | 'todas';
}

export function useVistoriasEvento(filtros: FiltrosVistoria = {}) {
  const { user } = useAuth();
  const { periodo = 'todas', status = 'todas' } = filtros;

  return useQuery({
    queryKey: ['vistorias-evento', user?.id, periodo, status],
    queryFn: async () => {
      let query = supabase
        .from('vistorias_evento' as any)
        .select(`
          *,
          sinistro:sinistros!vistorias_evento_sinistro_id_fkey(
            id, protocolo, tipo, data_ocorrencia,
            associado:associados!sinistros_associado_id_fkey(id, nome, telefone, whatsapp),
            veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo, ano_modelo, cor)
          ),
          regulador:profiles!vistorias_evento_regulador_id_fkey(id, nome)
        `)
        .order('data_agendada', { ascending: true })
        .order('horario_agendado', { ascending: true });

      // Filtro de data
      const hoje = new Date();
      if (periodo === 'hoje') {
        query = query.eq('data_agendada', format(hoje, 'yyyy-MM-dd'));
      } else if (periodo === 'amanha') {
        query = query.eq('data_agendada', format(addDays(hoje, 1), 'yyyy-MM-dd'));
      } else if (periodo === 'semana') {
        const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
        const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 });
        query = query
          .gte('data_agendada', format(inicioSemana, 'yyyy-MM-dd'))
          .lte('data_agendada', format(fimSemana, 'yyyy-MM-dd'));
      }

      // Filtro de status
      if (status === 'todas') {
        query = query.in('status', ['agendada', 'em_andamento']);
      } else {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });
}

export function useVistoriasEventoContadores() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vistorias-evento-contadores', user?.id],
    queryFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const fimSemana = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      // Hoje
      const { count: countHoje } = await supabase
        .from('vistorias_evento' as any)
        .select('id', { count: 'exact', head: true })
        .eq('data_agendada', hoje)
        .neq('status', 'cancelada');

      // Semana
      const { count: countSemana } = await supabase
        .from('vistorias_evento' as any)
        .select('id', { count: 'exact', head: true })
        .gte('data_agendada', inicioSemana)
        .lte('data_agendada', fimSemana)
        .neq('status', 'cancelada');

      // Pendentes
      const { count: countPendentes } = await supabase
        .from('vistorias_evento' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'agendada');

      return {
        hoje: countHoje || 0,
        semana: countSemana || 0,
        pendentes: countPendentes || 0,
      };
    },
    enabled: !!user,
  });
}
