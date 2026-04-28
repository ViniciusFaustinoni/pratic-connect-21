import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LiberacaoAutoVistoriaItem {
  contrato_id: string;
  veiculo_id: string;
  associado_id: string;
  associado_nome: string | null;
  associado_telefone: string | null;
  placa: string | null;
  modelo: string | null;
  marca: string | null;
  data_assinatura: string | null;
  cobertura_suspensa_em: string | null;
  dias_suspenso: number;
}

export function useLiberacoesAutoVistoria() {
  return useQuery<LiberacaoAutoVistoriaItem[]>({
    queryKey: ['liberacoes-autovistoria'],
    queryFn: async () => {
      // Veículos suspensos por instalação fora do prazo
      // (motivo legado "Auto-vistoria sem instalação no prazo" + motivo novo "Instalação não realizada no prazo de Xh...")
      const { data: veiculos, error } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, cobertura_suspensa_em, cobertura_suspensa_motivo')
        .eq('cobertura_suspensa', true)
        .or('cobertura_suspensa_motivo.eq.Auto-vistoria sem instalação no prazo,cobertura_suspensa_motivo.ilike.Instalação não realizada%');
      if (error) throw error;
      if (!veiculos?.length) return [];

      const veiculoIds = veiculos.map(v => v.id);

      const { data: contratos } = await supabase
        .from('contratos')
        .select('id, veiculo_id, associado_id, data_assinatura, liberado_reagendamento_em')
        .in('veiculo_id', veiculoIds)
        .in('status', ['ativo', 'assinado'])
        .is('liberado_reagendamento_em', null);

      const associadoIds = [...new Set((contratos ?? []).map(c => c.associado_id).filter(Boolean))];
      const { data: associados } = await supabase
        .from('associados')
        .select('id, nome, telefone')
        .in('id', associadoIds);

      const assocMap = new Map((associados ?? []).map(a => [a.id, a]));
      const veiculoMap = new Map(veiculos.map(v => [v.id, v]));

      const now = Date.now();
      return (contratos ?? []).map(c => {
        const v = veiculoMap.get(c.veiculo_id!);
        const a = assocMap.get(c.associado_id);
        const susEm = v?.cobertura_suspensa_em ? new Date(v.cobertura_suspensa_em).getTime() : now;
        return {
          contrato_id: c.id,
          veiculo_id: c.veiculo_id!,
          associado_id: c.associado_id,
          associado_nome: a?.nome ?? null,
          associado_telefone: a?.telefone ?? null,
          placa: v?.placa ?? null,
          modelo: v?.modelo ?? null,
          marca: v?.marca ?? null,
          data_assinatura: c.data_assinatura,
          cobertura_suspensa_em: v?.cobertura_suspensa_em ?? null,
          dias_suspenso: Math.max(0, Math.floor((now - susEm) / (1000 * 60 * 60 * 24))),
        } satisfies LiberacaoAutoVistoriaItem;
      });
    },
    staleTime: 30_000,
  });
}

export function useLiberarAutoVistoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contrato_ids, motivo }: { contrato_ids: string[]; motivo?: string }) => {
      const { data, error } = await supabase.functions.invoke('liberar-reagendamento-autovistoria', {
        body: { contrato_ids, motivo },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data?.liberados ?? 0} associado(s) liberado(s). WhatsApp enviado.`);
      qc.invalidateQueries({ queryKey: ['liberacoes-autovistoria'] });
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Erro ao liberar');
    },
  });
}
