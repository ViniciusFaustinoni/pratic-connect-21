import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EnvioLogsFilters {
  busca: string;
  status: 'todos' | 'enviada' | 'erro' | 'entregue' | 'lida';
  pagina: number;
}

const POR_PAGINA = 20;

export function useWhatsAppEnvioLogs() {
  const [filtros, setFiltros] = useState<EnvioLogsFilters>({
    busca: '',
    status: 'todos',
    pagina: 1,
  });

  const query = useQuery({
    queryKey: ['whatsapp-envio-logs', filtros],
    queryFn: async () => {
      let q = supabase
        .from('whatsapp_mensagens')
        .select('*', { count: 'exact' })
        .eq('direcao', 'saida')
        .order('created_at', { ascending: false })
        .range((filtros.pagina - 1) * POR_PAGINA, filtros.pagina * POR_PAGINA - 1);

      if (filtros.status !== 'todos') {
        q = q.eq('status', filtros.status);
      }

      if (filtros.busca.trim()) {
        q = q.or(`telefone.ilike.%${filtros.busca}%,mensagem.ilike.%${filtros.busca}%,template_id.ilike.%${filtros.busca}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data || [], total: count || 0 };
    },
  });

  const totalPaginas = Math.ceil((query.data?.total || 0) / POR_PAGINA);

  return {
    logs: query.data?.data || [],
    total: query.data?.total || 0,
    totalPaginas,
    isLoading: query.isLoading,
    filtros,
    setFiltros,
    setPagina: (p: number) => setFiltros(f => ({ ...f, pagina: p })),
    setBusca: (b: string) => setFiltros(f => ({ ...f, busca: b, pagina: 1 })),
    setStatus: (s: EnvioLogsFilters['status']) => setFiltros(f => ({ ...f, status: s, pagina: 1 })),
  };
}
