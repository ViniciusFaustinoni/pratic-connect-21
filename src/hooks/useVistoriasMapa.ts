import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  rota_cor: string | null;
  vistoriador_nome: string | null;
  vistorias: VistoriaMapa[];
}

interface UseVistoriasMapaOptions {
  filtrarPorUsuario?: boolean;
}

export function useVistoriasMapa(options: UseVistoriasMapaOptions = {}) {
  const { profile } = useAuth();
  const { filtrarPorUsuario = false } = options;

  return useQuery({
    queryKey: ["vistorias-mapa", filtrarPorUsuario ? profile?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("view_vistorias_mapa")
        .select("*")
        .order("data_agendada", { ascending: true });

      // Filtrar pelo usuário logado se solicitado
      if (filtrarPorUsuario && profile?.id) {
        query = query.eq("vistoriador_id", profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VistoriaMapa[];
    },
    enabled: !filtrarPorUsuario || !!profile?.id,
    refetchInterval: 60000,
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
        rota_cor: v.rota_cor,
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
