import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WhatsAppStatusResponse, WhatsAppQRCodeResponse } from '@/types/whatsapp';

export function useWhatsAppStatus(instanciaId?: string) {
  const queryClient = useQueryClient();

  // Query para status
  const statusQuery = useQuery({
    queryKey: ['whatsapp-status', instanciaId],
    queryFn: async (): Promise<WhatsAppStatusResponse> => {
      const { data, error } = await supabase.functions.invoke('whatsapp-status', {
        body: { instancia_id: instanciaId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao verificar status');
      
      return data;
    },
    refetchInterval: 30000, // Verificar a cada 30s
    staleTime: 10000,
    retry: 1,
  });

  // Mutation para obter QR Code
  const obterQRCode = useMutation({
    mutationFn: async (): Promise<WhatsAppQRCodeResponse> => {
      const { data, error } = await supabase.functions.invoke('whatsapp-qrcode', {
        body: { instancia_id: instanciaId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao gerar QR Code');
      
      return data;
    },
    onSuccess: () => {
      toast.info('QR Code gerado! Escaneie com o WhatsApp.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar QR Code: ${error.message}`);
    },
  });

  // Mutation para desconectar
  const desconectar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('whatsapp-logout', {
        body: { instancia_id: instanciaId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao desconectar');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
      toast.success('WhatsApp desconectado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });

  // Função para forçar refresh
  const atualizarStatus = async () => {
    await queryClient.invalidateQueries({ queryKey: ['whatsapp-status', instanciaId] });
  };

  return {
    status: statusQuery.data?.status || 'disconnected',
    connected: statusQuery.data?.connected || false,
    instancia: statusQuery.data?.instancia,
    telefone: statusQuery.data?.telefone,
    isLoading: statusQuery.isLoading,
    isRefetching: statusQuery.isRefetching,
    error: statusQuery.error,
    refetch: statusQuery.refetch,
    atualizarStatus,
    obterQRCode,
    desconectar,
  };
}
