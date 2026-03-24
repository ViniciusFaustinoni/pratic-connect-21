import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VistoriaPrestadorLink {
  id: string;
  instalacao_id: string;
  vistoriador_prestador_id: string;
  status: string;
  valor: number | null;
  chegada_em: string | null;
  concluida_em: string | null;
  foto_comprovante_url: string | null;
  whatsapp_enviado: boolean | null;
  created_at: string;
  updated_at: string;
  checklist_data: any;
  fotos_vistoria: any;
  assinatura_url: string | null;
  // joined
  prestador_nome: string;
  prestador_telefone: string | null;
  associado_nome: string | null;
  cidade: string | null;
  bairro: string | null;
  data_agendada: string | null;
}

const QUERY_KEY = ['vistorias-prestadores-dashboard'];

export function useVistoriasPrestadoresDashboard() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<VistoriaPrestadorLink[]> => {
      const { data, error } = await (supabase as any)
        .from('vistoria_prestador_links')
        .select(`
          *,
          vistoriadores_prestadores!inner(nome, telefone),
          instalacoes!inner(associado_nome, cidade, bairro, data_agendada)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        ...row,
        prestador_nome: row.vistoriadores_prestadores?.nome ?? '',
        prestador_telefone: row.vistoriadores_prestadores?.telefone ?? null,
        associado_nome: row.instalacoes?.associado_nome ?? null,
        cidade: row.instalacoes?.cidade ?? null,
        bairro: row.instalacoes?.bairro ?? null,
        data_agendada: row.instalacoes?.data_agendada ?? null,
      }));
    },
    refetchInterval: 30000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('vistoria-prestador-links-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vistoria_prestador_links' }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const metricas = useMemo(() => {
    const items = query.data ?? [];
    const aguardando = items.filter(i => i.status === 'aguardando').length;
    const emExecucao = items.filter(i => i.status === 'em_execucao').length;
    const concluidas = items.filter(i => i.status === 'concluida').length;
    const valorPrevisto = items.reduce((sum, i) => sum + (i.valor ?? 0), 0);
    const valorPago = items.filter(i => i.status === 'concluida').reduce((sum, i) => sum + (i.valor ?? 0), 0);

    return { total: items.length, aguardando, emExecucao, concluidas, valorPrevisto, valorPago };
  }, [query.data]);

  return { ...query, metricas };
}
