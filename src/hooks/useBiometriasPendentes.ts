import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BiometriaPendente {
  id: string;
  numero: string | null;
  status: string | null;
  autentique_status: string | null;
  autentique_url: string | null;
  autentique_documento_id: string | null;
  data_envio: string | null;
  data_visualizacao: string | null;
  updated_at: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  cliente_telefone: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  associado_id: string | null;
  vendedor_id: string | null;
  biometric_resent_at: string | null;
  biometric_resend_count: number | null;
  biometric_resent_by: string | null;
}

export interface BiometriasPendentesResult {
  contratos: BiometriaPendente[];
  totalReview: number;
  totalRejected: number;
  total: number;
}

/**
 * Hook que lista contratos com biometria do Autentique pendente:
 * - 'biometric_review' → aguardando aprovação manual da equipe Autentique
 * - 'biometric_rejected' → selfie reprovada, requer reenvio ao cliente
 *
 * Auto-refresh a cada 60s (alinhado com useAutentiqueBiometricStatus).
 */
export function useBiometriasPendentes() {
  return useQuery<BiometriasPendentesResult>({
    queryKey: ['biometrias-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id, numero, status, autentique_status, autentique_url, autentique_documento_id,
          data_envio, data_visualizacao, updated_at,
          cliente_nome, cliente_cpf, cliente_telefone,
          veiculo_marca, veiculo_modelo, veiculo_placa,
          associado_id, vendedor_id,
          biometric_resent_at, biometric_resend_count, biometric_resent_by
        `)
        .in('autentique_status', ['biometric_review', 'biometric_rejected'])
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const contratos = (data || []) as BiometriaPendente[];
      const totalReview = contratos.filter((c) => c.autentique_status === 'biometric_review').length;
      const totalRejected = contratos.filter((c) => c.autentique_status === 'biometric_rejected').length;

      return {
        contratos,
        totalReview,
        totalRejected,
        total: contratos.length,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * Hook leve só com a contagem — usado no badge do sidebar.
 * Compartilha cache com useBiometriasPendentes via select.
 */
export function useBiometriasPendentesCount() {
  return useQuery<number>({
    queryKey: ['biometrias-pendentes-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contratos')
        .select('id', { count: 'exact', head: true })
        .in('autentique_status', ['biometric_review', 'biometric_rejected']);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
