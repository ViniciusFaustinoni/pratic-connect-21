import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VistoriaMapa {
  id: string;
  tipo_servico: string;
  tipo_vistoria: string;
  status: string;
  data_agendada: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_cep: string | null;
  latitude: number | null;
  longitude: number | null;
  associado_id: string | null;
  associado_nome: string | null;
  associado_telefone: string | null;
  veiculo_id: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  vistoriador_id: string | null;
  vistoriador_nome: string | null;
}

export function useVistoriasMapa() {
  return useQuery({
    queryKey: ["vistorias-mapa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_vistorias_mapa")
        .select("*")
        .order("data_agendada", { ascending: true });

      if (error) throw error;
      return (data || []) as VistoriaMapa[];
    },
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });
}
