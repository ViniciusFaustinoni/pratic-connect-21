import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SolicitarAssinaturaParams {
  vistoriaId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  hodometro: number;
  avarias: string[];
  vistoriadorNome: string;
}

interface AssinaturaStatus {
  id: string;
  autentique_id: string | null;
  status: 'pendente' | 'enviada' | 'assinada' | 'recusada' | 'expirada';
  enviada_em: string | null;
  assinada_em: string | null;
  documento_url: string | null;
}

export function useAssinaturaVistoria(vistoriaId: string) {
  const queryClient = useQueryClient();

  // Buscar status atual da assinatura
  const { data: assinatura, isLoading } = useQuery({
    queryKey: ['assinatura-vistoria', vistoriaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vistorias')
        .select(`
          id,
          assinatura_status,
          assinatura_autentique_id,
          assinatura_enviada_em,
          assinatura_concluida_em,
          assinatura_documento_url
        `)
        .eq('id', vistoriaId)
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        autentique_id: data.assinatura_autentique_id,
        status: (data.assinatura_status || 'pendente') as AssinaturaStatus['status'],
        enviada_em: data.assinatura_enviada_em,
        assinada_em: data.assinatura_concluida_em,
        documento_url: data.assinatura_documento_url,
      } as AssinaturaStatus;
    },
    enabled: !!vistoriaId,
  });

  // Solicitar assinatura via Autentique
  const solicitarAssinatura = useMutation({
    mutationFn: async (params: SolicitarAssinaturaParams) => {
      const { data, error } = await supabase.functions.invoke('autentique-vistoria-create', {
        body: params,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao criar documento');

      return data;
    },
    onSuccess: () => {
      toast.success('Solicitação de assinatura enviada por email!');
      queryClient.invalidateQueries({ queryKey: ['assinatura-vistoria', vistoriaId] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao solicitar assinatura: ' + error.message);
    },
  });

  // Verificar status no Autentique
  const verificarStatus = useMutation({
    mutationFn: async () => {
      if (!assinatura?.autentique_id) {
        throw new Error('Assinatura não foi solicitada ainda');
      }

      const { data, error } = await supabase.functions.invoke('autentique-status', {
        body: { documentId: assinatura.autentique_id }
      });

      if (error) throw error;

      // Mapear status do Autentique para nosso status
      let novoStatus: AssinaturaStatus['status'] = assinatura.status;
      let assinadaEm: string | null = null;
      let documentoUrl: string | null = null;

      if (data.document?.status === 'signed') {
        novoStatus = 'assinada';
        assinadaEm = new Date().toISOString();
        documentoUrl = data.document.signedFileUrl;
      } else if (data.document?.status === 'rejected') {
        novoStatus = 'recusada';
      }

      if (novoStatus !== assinatura.status) {
        await supabase
          .from('vistorias')
          .update({
            assinatura_status: novoStatus,
            assinatura_concluida_em: assinadaEm,
            assinatura_documento_url: documentoUrl,
          })
          .eq('id', vistoriaId);
      }

      return { status: novoStatus, documentoUrl };
    },
    onSuccess: (data) => {
      if (data.status === 'assinada') {
        toast.success('Documento assinado com sucesso!');
      } else {
        toast.info('Aguardando assinatura do cliente');
      }
      queryClient.invalidateQueries({ queryKey: ['assinatura-vistoria', vistoriaId] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao verificar status: ' + error.message);
    },
  });

  // Reenviar email de assinatura
  const reenviarEmail = useMutation({
    mutationFn: async () => {
      if (!assinatura?.autentique_id) {
        throw new Error('Assinatura não foi solicitada ainda');
      }

      const { data, error } = await supabase.functions.invoke('autentique-resend', {
        body: { documentId: assinatura.autentique_id }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Email de assinatura reenviado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao reenviar: ' + error.message);
    },
  });

  return {
    assinatura,
    isLoading,
    solicitarAssinatura: solicitarAssinatura.mutate,
    isSolicitando: solicitarAssinatura.isPending,
    verificarStatus: verificarStatus.mutate,
    isVerificando: verificarStatus.isPending,
    reenviarEmail: reenviarEmail.mutate,
    isReenviando: reenviarEmail.isPending,
  };
}
