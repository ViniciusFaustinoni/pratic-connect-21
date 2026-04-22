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

type UnifiedCharge = {
  id: string;
  status: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  referencia: string | null;
  tipo: string | null;
  fonte: 'asaas' | 'sga';
};

const PAID_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const OPEN_STATUSES = ['PENDING', 'OVERDUE'];

function normalizeSgaStatus(status: string | null | undefined): string {
  const value = (status || '').trim().toLowerCase();
  if (value === 'pago') return 'RECEIVED';
  if (value === 'vencido') return 'OVERDUE';
  if (value === 'cancelado') return 'DELETED';
  return 'PENDING';
}

function buildSgaReference(cobranca: any): string | null {
  if (cobranca?.referencia_mes && cobranca?.referencia_ano) {
    return `${String(cobranca.referencia_mes).padStart(2, '0')}/${cobranca.referencia_ano}`;
  }
  return cobranca?.tipo_boleto_hinova || cobranca?.descricao || 'Mensalidade SGA';
}

function mapAsaasCharge(cobranca: any): UnifiedCharge {
  return {
    id: cobranca.id,
    status: cobranca.status || 'PENDING',
    valor: Number(cobranca.pagamento_valor ?? cobranca.valor_liquido ?? cobranca.valor) || 0,
    data_vencimento: cobranca.data_vencimento,
    data_pagamento: cobranca.data_pagamento || cobranca.pagamento_data || null,
    referencia: cobranca.referencia || cobranca.competencia || cobranca.tipo || 'Cobrança',
    tipo: cobranca.tipo || null,
    fonte: 'asaas',
  };
}

function mapSgaCharge(cobranca: any): UnifiedCharge {
  return {
    id: cobranca.id,
    status: normalizeSgaStatus(cobranca.status),
    valor: Number(cobranca.valor_final ?? cobranca.valor) || 0,
    data_vencimento: cobranca.data_vencimento,
    data_pagamento: cobranca.data_pagamento || null,
    referencia: buildSgaReference(cobranca),
    tipo: cobranca.tipo || 'mensalidade',
    fonte: 'sga',
  };
}

function sortByDueDateDesc(a: UnifiedCharge, b: UnifiedCharge) {
  return new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime();
}

function sortByDueDateAsc(a: UnifiedCharge, b: UnifiedCharge) {
  return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
}

async function fetchUnifiedCharges(associadoId: string) {
  const [asaasResult, sgaResult] = await Promise.all([
    supabase
      .from('asaas_cobrancas')
      .select('*')
      .eq('associado_id', associadoId),
    supabase
      .from('cobrancas')
      .select('*')
      .eq('associado_id', associadoId)
      .eq('origem', 'sga_hinova'),
  ]);

  if (asaasResult.error) throw asaasResult.error;
  if (sgaResult.error) throw sgaResult.error;

  const asaas = (asaasResult.data || []).map(mapAsaasCharge);
  const sga = (sgaResult.data || []).map(mapSgaCharge);

  return [...asaas, ...sga];
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
        .select('id, cotacao_id, status, valor_mensal, valor_adesao, dia_vencimento, data_inicio, cliente_cnh_validade, pdf_url, pdf_assinado_url, numero')
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

      const cobrancas = (await fetchUnifiedCharges(associadoId)).sort(sortByDueDateAsc);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const mesesPagos = cobrancas.filter((c) => PAID_STATUSES.includes(c.status)).length;

      const emAtraso = cobrancas.filter((c) => {
        const vencimento = new Date(c.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return c.status === 'OVERDUE' || (c.status === 'PENDING' && vencimento < hoje);
      }).length;

      const proximaCobranca = cobrancas.find((c) => {
        const vencimento = new Date(c.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return c.status === 'PENDING' && vencimento >= hoje;
      }) || null;

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

      const faturas = (await fetchUnifiedCharges(associadoId)).sort(sortByDueDateDesc);

      const pago = faturas
        .filter((f) => PAID_STATUSES.includes(f.status))
        .reduce((acc, f) => acc + (f.valor || 0), 0);

      const emAberto = faturas
        .filter((f) => OPEN_STATUSES.includes(f.status))
        .reduce((acc, f) => acc + (f.valor || 0), 0);

      return { faturas, totais: { pago, emAberto } };
    },
    enabled: !!associadoId,
  });
}
