import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendToAutentiqueParams {
  contratoId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf?: string;
  clienteTelefone?: string;
}

interface AutentiqueResponse {
  success: boolean;
  documentId?: string;
  signatureLink?: string;
  message?: string;
  error?: string;
}

interface AutentiqueStatusResponse {
  success: boolean;
  document?: {
    id: string;
    name: string;
    createdAt: string;
    status: 'pending' | 'in_progress' | 'signed' | 'rejected';
    signedFileUrl: string | null;
    originalFileUrl: string | null;
  };
  signatures?: Array<{
    name: string;
    email: string;
    action: string;
    link: string;
    viewed: string | null;
    signed: string | null;
    rejected: { date: string; reason: string } | null;
    status: 'pending' | 'viewed' | 'signed' | 'rejected';
  }>;
  error?: string;
}

export function useSendToAutentique() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendToAutentiqueParams): Promise<AutentiqueResponse> => {
      const { data, error } = await supabase.functions.invoke('autentique-create', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao enviar para Autentique');
      
      return data;
    },
    onSuccess: (data) => {
      toast.success('Proposta enviada para assinatura!', {
        description: 'O associado receberá um email com o link para assinar.',
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar proposta', {
        description: error.message,
      });
    },
  });
}

export function useAutentiqueStatus(documentId: string | undefined) {
  return useQuery({
    queryKey: ['autentique-status', documentId],
    queryFn: async (): Promise<AutentiqueStatusResponse> => {
      if (!documentId) throw new Error('Document ID não fornecido');

      const { data, error } = await supabase.functions.invoke('autentique-status', {
        body: { documentId },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!documentId,
    refetchInterval: (query) => {
      // Refetch a cada 30s se ainda não foi assinado
      const data = query.state.data;
      if (data?.document?.status === 'signed' || data?.document?.status === 'rejected') {
        return false;
      }
      return 30000;
    },
  });
}

export function useCheckAutentiqueStatus() {
  return useMutation({
    mutationFn: async (documentId: string): Promise<AutentiqueStatusResponse> => {
      const { data, error } = await supabase.functions.invoke('autentique-status', {
        body: { documentId },
      });

      if (error) throw error;
      return data;
    },
    onError: (error: any) => {
      toast.error('Erro ao verificar status', {
        description: error.message,
      });
    },
  });
}

// Reenviar email de assinatura
export function useResendAutentique() {
  return useMutation({
    mutationFn: async (documentId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      const { data, error } = await supabase.functions.invoke('autentique-resend', {
        body: { documentId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao reenviar email');
      
      return data;
    },
    onSuccess: () => {
      toast.success('Email reenviado com sucesso!', {
        description: 'O cliente receberá um novo email com o link para assinar.',
      });
    },
    onError: (error: any) => {
      toast.error('Erro ao reenviar email', {
        description: error.message,
      });
    },
  });
}

// Cancelar documento
export function useCancelAutentique() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { documentId: string; contratoId: string }): Promise<{ success: boolean; message?: string; error?: string }> => {
      const { data, error } = await supabase.functions.invoke('autentique-cancel', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao cancelar documento');
      
      return data;
    },
    onSuccess: () => {
      toast.success('Documento cancelado!', {
        description: 'A proposta foi cancelada e o associado não poderá mais assinar.',
      });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao cancelar documento', {
        description: error.message,
      });
    },
  });
}

// Helper function to get status label
export function getAutentiqueStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'signed':
      return { label: 'Assinado', color: 'bg-green-100 text-green-800' };
    case 'rejected':
      return { label: 'Rejeitado', color: 'bg-red-100 text-red-800' };
    case 'in_progress':
      return { label: 'Visualizado', color: 'bg-blue-100 text-blue-800' };
    case 'pending':
    default:
      return { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800' };
  }
}

// Helper para enviar link via WhatsApp
export function getWhatsAppLink(phone: string, url: string, clientName?: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const greeting = clientName ? `Olá ${clientName}! ` : 'Olá! ';
  const message = encodeURIComponent(
    `${greeting}Segue o link para assinar sua proposta de filiação: ${url}`
  );
  return `https://wa.me/${formattedPhone}?text=${message}`;
}
