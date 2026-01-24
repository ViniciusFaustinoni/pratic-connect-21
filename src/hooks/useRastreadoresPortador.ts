import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RastreadorEmPorte {
  id: string;
  codigo: string;
  imei: string | null;
  numero_serie: string | null;
  plataforma: string;
}

/**
 * Hook para buscar rastreadores em porte do vistoriador logado
 * Retorna apenas rastreadores com status 'estoque' e portador_id = profile.id
 */
export function useRastreadoresDoPortador() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['rastreadores-meu-porte', profile?.id],
    enabled: !!profile?.id,
    queryFn: async (): Promise<RastreadorEmPorte[]> => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, imei, numero_serie, plataforma')
        .eq('portador_id', profile!.id)
        .eq('status', 'estoque')
        .order('codigo');

      if (error) throw error;
      return (data || []) as RastreadorEmPorte[];
    },
  });
}

/**
 * Hook para contar rastreadores em porte de um usuário específico
 */
export function useContagemRastreadoresPortador(portadorId: string | undefined) {
  return useQuery({
    queryKey: ['rastreadores-porte-contagem', portadorId],
    enabled: !!portadorId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('rastreadores')
        .select('*', { count: 'exact', head: true })
        .eq('portador_id', portadorId!)
        .eq('status', 'estoque');

      if (error) throw error;
      return count || 0;
    },
  });
}
