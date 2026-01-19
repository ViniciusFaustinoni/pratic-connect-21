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
  associado_nome: string | null;
  associado_telefone: string | null;
  associado_whatsapp: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  veiculo_cor: string | null;
  vistoriador_id: string | null;
  horario_agendado: string | null;
  // Campos de rota
  rota_id: string | null;
  rota_codigo: string | null;
  rota_regiao: string | null;
  rota_cor: string | null;
  vistoriador_nome: string | null;
}

export interface RotaAgrupada {
  rota_id: string | null;
  rota_codigo: string | null;
  rota_regiao: string | null;
  vistoriador_nome: string | null;
  vistorias: VistoriaMapa[];
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

/**
 * Agrupa vistorias por rota
 */
export function agruparPorRota(vistorias: VistoriaMapa[]): RotaAgrupada[] {
  const grupos = new Map<string | null, RotaAgrupada>();

  vistorias.forEach((v) => {
    const key = v.rota_id || 'sem_rota';
    
    if (!grupos.has(key)) {
      grupos.set(key, {
        rota_id: v.rota_id,
        rota_codigo: v.rota_codigo,
        rota_regiao: v.rota_regiao,
        vistoriador_nome: v.vistoriador_nome,
        vistorias: [],
      });
    }
    
    grupos.get(key)!.vistorias.push(v);
  });

  // Ordenar: rotas com ID primeiro, sem rota por último
  return Array.from(grupos.values()).sort((a, b) => {
    if (a.rota_id && !b.rota_id) return -1;
    if (!a.rota_id && b.rota_id) return 1;
    return (a.rota_codigo || '').localeCompare(b.rota_codigo || '');
  });
}
