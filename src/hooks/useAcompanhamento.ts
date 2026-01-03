import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AcompanhamentoItem {
  lead_id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  vendedor_id: string | null;
  associado_id: string | null;
  associado_status: string | null;
  veiculo_id: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  veiculo_status: string | null;
  instalacao_id: string | null;
  instalacao_status: string | null;
  instalacao_data: string | null;
  docs_total: number;
  docs_aprovados: number;
  fase_acompanhamento: string;
  vendedor_nome: string | null;
  updated_at: string;
}

export function useAcompanhamento() {
  return useQuery({
    queryKey: ['acompanhamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_acompanhamento')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as AcompanhamentoItem[];
    },
  });
}
