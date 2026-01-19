import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface RotaBairro {
  rota_id: string;
  codigo: string;
  cor: string;
  bairros: string[];
}

export function useRotasBairros(data?: Date) {
  return useQuery({
    queryKey: ["rotas-bairros", data ? format(data, "yyyy-MM-dd") : "hoje"],
    queryFn: async (): Promise<RotaBairro[]> => {
      const dataFiltro = data ? format(data, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      
      // Buscar rotas da data
      const { data: rotas, error: rotasError } = await supabase
        .from("rotas")
        .select("id, codigo, cor")
        .eq("data_rota", dataFiltro);
      
      if (rotasError) throw rotasError;
      if (!rotas?.length) return [];

      const rotaIds = rotas.map(r => r.id);
      
      // Buscar bairros de instalações
      const { data: instalacoes } = await supabase
        .from("instalacoes")
        .select("rota_id, bairro")
        .in("rota_id", rotaIds)
        .not("bairro", "is", null);
      
      // Buscar bairros de cotações
      const { data: cotacoes } = await supabase
        .from("cotacoes")
        .select("vistoria_rota_id, vistoria_endereco_bairro")
        .in("vistoria_rota_id", rotaIds)
        .not("vistoria_endereco_bairro", "is", null);
      
      // Buscar bairros de contratos
      const { data: contratos } = await supabase
        .from("contratos")
        .select("vistoria_rota_id, vistoria_completa_endereco_bairro")
        .in("vistoria_rota_id", rotaIds)
        .not("vistoria_completa_endereco_bairro", "is", null);
      
      // Agrupar bairros por rota
      return rotas.map(rota => {
        const bairrosSet = new Set<string>();
        
        instalacoes?.filter(i => i.rota_id === rota.id)
          .forEach(i => {
            if (i.bairro) bairrosSet.add(i.bairro);
          });
        
        cotacoes?.filter(c => c.vistoria_rota_id === rota.id)
          .forEach(c => {
            if (c.vistoria_endereco_bairro) bairrosSet.add(c.vistoria_endereco_bairro);
          });
        
        contratos?.filter(c => c.vistoria_rota_id === rota.id)
          .forEach(c => {
            if (c.vistoria_completa_endereco_bairro) bairrosSet.add(c.vistoria_completa_endereco_bairro);
          });
        
        return {
          rota_id: rota.id,
          codigo: rota.codigo || "",
          cor: rota.cor || "#3B82F6",
          bairros: Array.from(bairrosSet),
        };
      });
    },
    refetchInterval: 60000,
  });
}
