import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WhatsAppMensagem } from '@/types/whatsapp';

/**
 * Hook para buscar histórico de mensagens WhatsApp de um contato
 */
export function useWhatsAppHistorico(telefone: string | null | undefined, limit = 100) {
  return useQuery({
    queryKey: ['whatsapp-historico', telefone],
    queryFn: async () => {
      if (!telefone) return [];

      // Normalizar telefone
      const telefoneLimpo = telefone.replace(/\D/g, '');
      const telefoneComDDI = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

      // Buscar mensagens locais do banco
      const { data, error } = await supabase
        .from('whatsapp_mensagens')
        .select('*')
        .or(`telefone.eq.${telefoneComDDI},telefone.eq.${telefoneLimpo}`)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[useWhatsAppHistorico] Erro ao buscar mensagens:', error);
        throw error;
      }

      return data as WhatsAppMensagem[];
    },
    enabled: !!telefone,
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });
}

/**
 * Hook para sincronizar histórico da Evolution API
 */
export function useSincronizarHistorico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (telefone: string) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-find-messages', {
        body: { telefone, limit: 100, sincronizar: true },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao sincronizar');

      return data;
    },
    onSuccess: (data, telefone) => {
      // Invalidar cache para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['whatsapp-historico', telefone] });
      
      if (data.sincronizado) {
        toast.success(`Histórico sincronizado! ${data.total} mensagens.`);
      } else if (data.evolution_error) {
        toast.warning(`Mostrando mensagens locais. ${data.evolution_error}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });
}

/**
 * Hook para listar todas as conversas WhatsApp
 */
export function useWhatsAppConversas() {
  return useQuery({
    queryKey: ['whatsapp-conversas'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-find-chats', {
        body: { buscar_vinculacao: true },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao buscar conversas');

      return data;
    },
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para atualizar lista de conversas
 */
export function useAtualizarConversas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-find-chats', {
        body: { buscar_vinculacao: true },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao atualizar');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversas'] });
      toast.success('Lista de conversas atualizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}
