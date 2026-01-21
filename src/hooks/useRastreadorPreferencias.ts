import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssociado } from './useMyData';
import { toast } from 'sonner';

export interface RastreadorPreferencias {
  id: string;
  associado_id: string;
  alerta_cerca_ativo: boolean;
  alerta_ignicao_ativo: boolean;
  alerta_velocidade_ativo: boolean;
  velocidade_limite: number;
  horario_alerta: 'sempre' | 'comercial' | 'noturno';
  horario_inicio: string;
  horario_fim: string;
  compartilhar_localizacao: boolean;
  dados_anonimos: boolean;
  novidades_promocoes: boolean;
}

const DEFAULTS: Partial<RastreadorPreferencias> = {
  alerta_cerca_ativo: true,
  alerta_ignicao_ativo: false,
  alerta_velocidade_ativo: false,
  velocidade_limite: 80,
  horario_alerta: 'sempre',
  compartilhar_localizacao: true,
  dados_anonimos: true,
  novidades_promocoes: true,
};

export function useRastreadorPreferencias() {
  const { data: associado } = useMyAssociado();
  
  return useQuery({
    queryKey: ['rastreador-preferencias', associado?.id],
    queryFn: async () => {
      if (!associado?.id) return null;
      
      // First try to get existing preferences
      const { data, error } = await supabase
        .from('rastreador_preferencias')
        .select('*')
        .eq('associado_id', associado.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      // If no preferences exist, create with defaults
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('rastreador_preferencias')
          .insert({ associado_id: associado.id, ...DEFAULTS })
          .select()
          .single();
        
        if (insertError) {
          console.error('Error creating preferences:', insertError);
          // Return defaults if insert fails (e.g., RLS issue)
          return { associado_id: associado.id, ...DEFAULTS } as RastreadorPreferencias;
        }
        
        return newData as RastreadorPreferencias;
      }
      
      return data as RastreadorPreferencias;
    },
    enabled: !!associado?.id,
  });
}

export function useUpdateRastreadorPreferencias() {
  const { data: associado } = useMyAssociado();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<RastreadorPreferencias>) => {
      if (!associado?.id) throw new Error('Associado não encontrado');
      
      // First check if record exists
      const { data: existing } = await supabase
        .from('rastreador_preferencias')
        .select('id')
        .eq('associado_id', associado.id)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('rastreador_preferencias')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('associado_id', associado.id);
        if (error) throw error;
      } else {
        // Insert new with updates
        const { error } = await supabase
          .from('rastreador_preferencias')
          .insert({ associado_id: associado.id, ...DEFAULTS, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rastreador-preferencias'] });
      toast.success('Preferência salva');
    },
    onError: (error: Error) => {
      console.error('Error updating preferences:', error);
      toast.error('Erro ao salvar preferência');
    },
  });
}
