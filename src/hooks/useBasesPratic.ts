import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BasePratic {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  latitude: number;
  longitude: number;
}

/**
 * Hook para buscar oficinas marcadas como Base da Pratic.
 * Retorna apenas oficinas com is_base_pratic=true e coordenadas válidas.
 */
export function useBasesPratic() {
  return useQuery({
    queryKey: ['bases-pratic'],
    queryFn: async (): Promise<BasePratic[]> => {
      const { data, error } = await supabase
        .from('oficinas')
        .select('id, razao_social, nome_fantasia, latitude, longitude')
        .eq('is_base_pratic', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;
      return (data || []).map((o: any) => ({
        id: o.id,
        razao_social: o.razao_social,
        nome_fantasia: o.nome_fantasia,
        latitude: o.latitude,
        longitude: o.longitude,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Calcula distância em metros entre dois pontos (Haversine)
 */
export function calcularDistanciaMetros(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // raio da terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
