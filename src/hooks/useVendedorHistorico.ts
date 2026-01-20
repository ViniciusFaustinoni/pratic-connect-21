import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface VendedorLeadsOptions {
  vendedorId: string;
  search?: string;
  etapa?: string;
  dataInicio?: Date;
  dataFim?: Date;
}

export function useVendedorLeads(options: VendedorLeadsOptions) {
  return useQuery({
    queryKey: ['vendedor-leads', options],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          *,
          cotacoes:cotacoes(id, numero, status, valor_total_mensal),
          contratos:contratos(id, numero, status)
        `)
        .eq('vendedor_id', options.vendedorId)
        .order('created_at', { ascending: false });

      if (options.search) {
        query = query.or(`nome.ilike.%${options.search}%,telefone.ilike.%${options.search}%,veiculo_placa.ilike.%${options.search}%`);
      }

      if (options.etapa && options.etapa !== 'todos') {
        query = query.eq('etapa', options.etapa as any);
      }

      if (options.dataInicio) {
        query = query.gte('created_at', options.dataInicio.toISOString());
      }

      if (options.dataFim) {
        query = query.lte('created_at', options.dataFim.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!options.vendedorId,
  });
}

export function useVendedorCotacoes(vendedorId: string) {
  return useQuery({
    queryKey: ['vendedor-cotacoes', vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          lead:leads(id, nome, telefone, veiculo_placa)
        `)
        .eq('vendedor_id', vendedorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!vendedorId,
  });
}

export function useVendedorContratos(vendedorId: string) {
  return useQuery({
    queryKey: ['vendedor-contratos', vendedorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          lead:leads(id, nome, telefone),
          plano:planos(id, nome)
        `)
        .eq('vendedor_id', vendedorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!vendedorId,
  });
}

export function useVendedorStats(vendedorId: string) {
  return useQuery({
    queryKey: ['vendedor-stats', vendedorId],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('etapa')
        .eq('vendedor_id', vendedorId);

      if (error) throw error;

      const stats = {
        total: leads?.length || 0,
        novos: 0,
        emAndamento: 0,
        ganhos: 0,
        perdidos: 0,
      };

      leads?.forEach((lead) => {
        switch (lead.etapa) {
          case 'novo':
            stats.novos++;
            break;
          case 'contato':
          case 'qualificado':
          case 'cotacao_enviada':
          case 'negociacao':
          case 'contrato_enviado':
          case 'contrato_assinado':
          case 'vistoria_agendada':
          case 'instalacao_agendada':
            stats.emAndamento++;
            break;
          case 'ganho':
            stats.ganhos++;
            break;
          case 'perdido':
            stats.perdidos++;
            break;
        }
      });

      return stats;
    },
    enabled: !!vendedorId,
  });
}
