import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VeiculoOficina {
  id: string;
  numero: string;
  status: string;
  data_entrada: string | null;
  created_at: string;
  updated_at: string;
  valor_orcamento: number | null;
  etapas_reparo: any[];
  observacoes: string | null;
  oficina: { id: string; nome_fantasia: string; razao_social: string; cidade: string; estado: string } | null;
  veiculo: { id: string; placa: string; marca: string; modelo: string; ano: number; cor: string } | null;
  associado: { id: string; nome: string; telefone: string; whatsapp: string | null } | null;
  sinistro: { id: string; protocolo: string } | null;
  auto_center: { id: string; nome_fantasia: string | null; nome: string } | null;
}

export interface OficinaFilters {
  oficina_id?: string;
  status?: string;
  tempo?: string;
  search?: string;
}

export function useVeiculosOficina(filters?: OficinaFilters) {
  return useQuery({
    queryKey: ['veiculos-oficina', filters],
    queryFn: async () => {
      const statusAtivos = [
        'aguardando_entrada',
        'aguardando_orcamento',
        'aguardando_aprovacao',
        'em_execucao',
        'aguardando_peca',
        'pendente_assinatura',
      ] as const;

      const query = supabase
        .from('ordens_servico')
        .select(`
          id, numero, status, data_entrada, created_at, updated_at, valor_orcamento, etapas_reparo, observacoes,
          oficina:oficinas(id, nome_fantasia, razao_social, cidade, estado),
          veiculo:veiculos(id, placa, marca, modelo, ano, cor),
          associado:associados(id, nome, telefone, whatsapp),
          sinistro:sinistros(id, protocolo)
        `)
        .in('status', statusAtivos)
        .order('created_at', { ascending: false });

      const { data, error } = await query as { data: any; error: any };
      if (error) throw error;

      let result = (data || []) as unknown as VeiculoOficina[];

      // Client-side filtering
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        result = result.filter(
          (v) =>
            v.veiculo?.placa?.toLowerCase().includes(s) ||
            v.associado?.nome?.toLowerCase().includes(s) ||
            v.numero?.toLowerCase().includes(s)
        );
      }

      if (filters?.tempo) {
        const now = Date.now();
        result = result.filter((v) => {
          const entrada = v.data_entrada || v.created_at;
          if (!entrada) return true;
          const dias = Math.floor((now - new Date(entrada).getTime()) / 86400000);
          switch (filters.tempo) {
            case '0-7': return dias <= 7;
            case '8-15': return dias >= 8 && dias <= 15;
            case '16-30': return dias >= 16 && dias <= 30;
            case '30+': return dias > 30;
            default: return true;
          }
        });
      }

      return result;
    },
  });
}

export function useOficinasDisponiveis() {
  return useQuery({
    queryKey: ['oficinas-disponiveis'],
    queryFn: async () => {
      const result = await supabase
        .from('oficinas')
        .select('id, nome_fantasia, razao_social')
        .order('nome_fantasia');
      const { data, error } = result as { data: any; error: any };
      if (error) throw error;
      return (data || []) as { id: string; nome_fantasia: string; razao_social: string }[];
    },
  });
}
