import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FilaServico {
  id: string;
  servico_id: string;
  profissional_id: string;
  distancia_km: number;
  prioridade: number;
  status: string;
  motivo: string | null;
  created_at: string;
  expires_at: string;
  servico: {
    id: string;
    tipo: string;
    logradouro: string | null;
    bairro: string | null;
    cidade: string | null;
    data_agendada: string | null;
    associado: { nome: string } | null;
  } | null;
  profissional: {
    id: string;
    nome: string;
  } | null;
}

export function useFilaServicos() {
  const queryClient = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('fila-servicos-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fila_servicos',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['fila-servicos'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const query = useQuery({
    queryKey: ['fila-servicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fila_servicos')
        .select(`
          id,
          servico_id,
          profissional_id,
          distancia_km,
          prioridade,
          status,
          motivo,
          created_at,
          expires_at,
          servico:servicos!fila_servicos_servico_id_fkey(
            id, tipo, logradouro, bairro, cidade, data_agendada, contrato_id, origem,
            associado:associados!servicos_associado_id_fkey(nome),
            contrato:contratos!servicos_contrato_id_fkey(aprovado_em, origem_troca_titularidade_id)
          ),
          profissional:profiles!fila_servicos_profissional_id_fkey(id, nome)
        `)
        .eq('status', 'aguardando')
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Gate canônico Cadastro→Monitoramento: oculta itens cujo serviço pertence
      // a contrato não aprovado (exceto troca de titularidade). Itens sem contrato
      // vinculado continuam visíveis. Ver mem://logic/operations/atribuicao-manual-gate-cadastro-aprovado
      const filtrados = ((data || []) as any[]).filter((row) => {
        const s = row.servico;
        if (!s || !s.contrato_id) return true;
        if (s.origem === 'troca_titularidade') return true;
        return !!s.contrato?.aprovado_em || !!s.contrato?.origem_troca_titularidade_id;
      });

      return filtrados as unknown as FilaServico[];
    },
    // Sem polling: realtime acima já invalida em qualquer mudança em fila_servicos.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  const forcarReatribuicao = useMutation({
    mutationFn: async ({ filaId, novoProf }: { filaId: string; novoProf: string }) => {
      // Buscar item da fila
      const { data: item, error: fetchErr } = await supabase
        .from('fila_servicos')
        .select('servico_id')
        .eq('id', filaId)
        .single();

      if (fetchErr || !item) throw new Error('Item não encontrado na fila');

      // Atribuir serviço ao novo profissional
      const { error: updateErr } = await supabase
        .from('servicos')
        .update({
          profissional_id: novoProf,
          status: 'agendada',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', item.servico_id);

      if (updateErr) throw updateErr;

      // Marcar fila como atribuído
      await supabase
        .from('fila_servicos')
        .update({ status: 'atribuido' } as any)
        .eq('id', filaId);
    },
    onSuccess: () => {
      toast.success('Serviço reatribuído com sucesso');
      queryClient.invalidateQueries({ queryKey: ['fila-servicos'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao reatribuir: ' + err.message);
    },
  });

  return { ...query, forcarReatribuicao };
}
