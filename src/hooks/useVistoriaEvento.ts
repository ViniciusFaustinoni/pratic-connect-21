import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ItemOrcamento {
  descricao: string;
  quantidade: number;
  tipo: string; // 'peca', 'mao_de_obra', 'servico'
  valor_unitario?: number;
  valor_total?: number;
  categoria?: string;
}

export interface EtapaReparo {
  nome: string;
  selecionada: boolean;
}

export interface VistoriaEventoData {
  id: string;
  sinistro_id: string;
  status: string;
  dados_vistoria: {
    itens_orcamento?: ItemOrcamento[];
    etapas_reparo?: EtapaReparo[];
    [key: string]: any;
  } | null;
  concluida_em: string | null;
}

export function useVistoriaEvento(sinistroId: string | undefined) {
  return useQuery({
    queryKey: ['vistoria-evento', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;

      const { data, error } = await supabase
        .from('vistorias_evento')
        .select('id, sinistro_id, status, dados_vistoria, concluida_em')
        .eq('sinistro_id', sinistroId)
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        dados_vistoria: data.dados_vistoria as VistoriaEventoData['dados_vistoria'],
      } as VistoriaEventoData;
    },
    enabled: !!sinistroId,
  });
}
