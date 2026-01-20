import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DocumentoCotacao {
  id: string;
  tipo: string;
  arquivo_nome: string | null;
  arquivo_url: string;
  status: string;
  created_at: string;
}

/**
 * Hook para buscar documentos da tabela contratos_documentos via cotacao_id
 */
export function useDocumentosCotacao(cotacaoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos-cotacao', cotacaoId],
    queryFn: async (): Promise<DocumentoCotacao[]> => {
      if (!cotacaoId) return [];

      const { data, error } = await supabase
        .from('contratos_documentos')
        .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DocumentoCotacao[];
    },
    enabled: !!cotacaoId,
  });
}

/**
 * Hook para buscar documentos da tabela contratos_documentos via contrato_id
 */
export function useDocumentosContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['documentos-contrato', contratoId],
    queryFn: async (): Promise<DocumentoCotacao[]> => {
      if (!contratoId) return [];

      const { data, error } = await supabase
        .from('contratos_documentos')
        .select('id, tipo, arquivo_nome, arquivo_url, status, created_at')
        .eq('contrato_id', contratoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DocumentoCotacao[];
    },
    enabled: !!contratoId,
  });
}

/**
 * Hook para buscar o contrato de um associado e retornar o cotacao_id
 */
export function useContratoDoAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['contrato-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;

      const { data, error } = await supabase
        .from('contratos')
        .select('id, cotacao_id, status, valor_mensal, valor_adesao, dia_vencimento, data_inicio')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
  });
}

/**
 * Hook para buscar resumo financeiro do associado (situação, próximo vencimento)
 */
export function useResumoFinanceiroAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['resumo-financeiro-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;

      // Buscar cobranças pagas (meses em dia)
      const { count: mesesPagos } = await supabase
        .from('cobrancas')
        .select('*', { count: 'exact', head: true })
        .eq('associado_id', associadoId)
        .eq('status', 'pago');

      // Buscar cobranças em atraso
      const hoje = new Date().toISOString().split('T')[0];
      const { count: emAtraso } = await supabase
        .from('cobrancas')
        .select('*', { count: 'exact', head: true })
        .eq('associado_id', associadoId)
        .in('status', ['pendente', 'em_aberto'])
        .lt('data_vencimento', hoje);

      // Próxima cobrança pendente
      const { data: proximaCobranca } = await supabase
        .from('cobrancas')
        .select('data_vencimento, valor')
        .eq('associado_id', associadoId)
        .in('status', ['pendente', 'em_aberto'])
        .gte('data_vencimento', hoje)
        .order('data_vencimento', { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        mesesPagos: mesesPagos || 0,
        emAtraso: emAtraso || 0,
        proximaCobranca,
      };
    },
    enabled: !!associadoId,
  });
}
