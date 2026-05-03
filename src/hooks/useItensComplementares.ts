import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ItemComplementarRow {
  id: string;
  ordem_servico_id: string;
  tipo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  status_aprovacao: 'pendente' | 'aprovado' | 'rejeitado';
  motivo_rejeicao: string | null;
  descoberto_em: string | null;
  observacao: string | null;
  cobertura_id: string | null;
  ordem_servico?: { numero: string; sinistro_id: string | null } | null;
}

export function useItensComplementaresPendentes(sinistroId?: string) {
  return useQuery({
    queryKey: ['itens-complementares-pendentes', sinistroId ?? 'all'],
    queryFn: async () => {
      let q = (supabase as any)
        .from('ordens_servico_itens')
        .select('*, ordem_servico:ordens_servico(numero, sinistro_id)')
        .eq('complementar', true)
        .eq('status_aprovacao', 'pendente')
        .order('descoberto_em', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as ItemComplementarRow[];
      if (sinistroId) {
        rows = rows.filter((r) => r.ordem_servico?.sinistro_id === sinistroId);
      }
      return rows;
    },
  });
}

export function useDecidirItemComplementar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      decisao,
      motivo,
    }: {
      id: string;
      decisao: 'aprovado' | 'rejeitado';
      motivo?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('ordens_servico_itens')
        .update({
          status_aprovacao: decisao,
          aprovado: decisao === 'aprovado',
          aprovado_por: userData.user?.id ?? null,
          aprovado_em: new Date().toISOString(),
          motivo_rejeicao: decisao === 'rejeitado' ? (motivo ?? null) : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['itens-complementares-pendentes'] });
      qc.invalidateQueries({ queryKey: ['os_itens'] });
      qc.invalidateQueries({ queryKey: ['custo-evento-cobertura'] });
      toast.success('Decisão registrada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}
