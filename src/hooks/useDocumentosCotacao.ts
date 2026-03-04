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
        .select('id, cotacao_id, status, valor_mensal, valor_adesao, dia_vencimento, data_inicio, cliente_cnh_validade')
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
      if (!associadoId) return { mesesPagos: 0, emAtraso: 0, proximaCobranca: null };

      const { data: cobrancas, error } = await supabase
        .from('asaas_cobrancas')
        .select('*')
        .eq('associado_id', associadoId)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const mesesPagos = (cobrancas || []).filter(
        c => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(c.status)
      ).length;

      const emAtraso = (cobrancas || []).filter(c => {
        const vencimento = new Date(c.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return c.status === 'PENDING' && vencimento < hoje;
      }).length;

      const proximaCobranca = (cobrancas || []).find(c => {
        const vencimento = new Date(c.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return c.status === 'PENDING' && vencimento >= hoje;
      });

      return { mesesPagos, emAtraso, proximaCobranca };
    },
    enabled: !!associadoId,
  });
}

// Hook para buscar cobranças do associado com totais
export function useCobrancasAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['cobrancas-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) return { faturas: [], totais: { pago: 0, emAberto: 0 } };

      const { data, error } = await supabase
        .from('asaas_cobrancas')
        .select('*')
        .eq('associado_id', associadoId)
        .order('data_vencimento', { ascending: false });

      if (error) throw error;

      const faturas = data || [];
      const pago = faturas
        .filter(f => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(f.status))
        .reduce((acc, f) => acc + (f.valor || 0), 0);
      const emAberto = faturas
        .filter(f => ['PENDING', 'OVERDUE'].includes(f.status))
        .reduce((acc, f) => acc + (f.valor || 0), 0);

      return { faturas, totais: { pago, emAberto } };
    },
    enabled: !!associadoId,
  });
}
