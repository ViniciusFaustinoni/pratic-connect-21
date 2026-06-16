import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// A tabela `solicitacoes_financeiras` é recente; os tipos gerados do Supabase
// ainda não a incluem. Usamos um client "solto" só neste módulo.
const sb = supabase as any;

// ============================================================
// CONSTANTES (compartilhadas com Contas a Pagar)
// ============================================================
export const SOLICITACAO_CATEGORIAS = [
  { value: 'prestador_assistencia', label: 'Prestador Assistência' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'folha_pagamento', label: 'Folha de Pagamento' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'outros', label: 'Outros' },
] as const;

export const SOLICITACAO_FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
] as const;

export const SOLICITACAO_STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pendente: { label: 'Aguardando liberação', variant: 'secondary' },
  aprovado: { label: 'Liberada (aguardando pagamento)', variant: 'outline' },
  rejeitado: { label: 'Rejeitada', variant: 'destructive' },
  pago: { label: 'Paga', variant: 'default' },
  cancelado: { label: 'Cancelada', variant: 'outline' },
};

export const SOLICITACAO_TIPO_LABEL: Record<string, string> = {
  pagamento: 'Pagamento',
  reembolso: 'Reembolso',
};

// ============================================================
// TIPOS
// ============================================================
export interface SolicitacaoFinanceira {
  id: string;
  tipo: 'pagamento' | 'reembolso';
  categoria: string;
  subcategoria: string | null;
  descricao: string;
  valor: number;
  solicitante_id: string | null;
  solicitante_nome: string;
  favorecido_nome: string | null;
  favorecido_documento: string | null;
  forma_pagamento: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix_chave: string | null;
  data_necessidade: string | null;
  comprovante_url: string;
  anexos_extras: string[];
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'pago' | 'cancelado';
  aprovacoes_necessarias: number;
  aprovacoes_count: number;
  rejeitado_por: string | null;
  rejeitado_em: string | null;
  motivo_rejeicao: string | null;
  pago_por: string | null;
  pago_em: string | null;
  conta_pagar_id: string | null;
  observacao: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface AprovacaoSolicitacao {
  id: string;
  solicitacao_id: string;
  socio_id: string;
  socio_nome: string | null;
  decisao: 'aprovado' | 'rejeitado';
  comentario: string | null;
  created_at: string;
}

export interface NovaSolicitacaoInput {
  tipo: 'pagamento' | 'reembolso';
  categoria: string;
  subcategoria?: string;
  descricao: string;
  valor: number;
  solicitante_id: string | null;
  solicitante_nome: string;
  favorecido_nome?: string;
  favorecido_documento?: string;
  forma_pagamento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix_chave?: string;
  data_necessidade?: string;
  comprovante_url: string;
  observacao?: string;
  criado_por: string | null;
}

interface SolicitacoesFilters {
  status?: string;
  tipo?: string;
}

// ============================================================
// QUERIES
// ============================================================
export function useSolicitacoesFinanceiras(filters: SolicitacoesFilters = {}) {
  return useQuery({
    queryKey: ['solicitacoes-financeiras', filters.status, filters.tipo],
    queryFn: async (): Promise<SolicitacaoFinanceira[]> => {
      let query = sb
        .from('solicitacoes_financeiras')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data ?? []) as SolicitacaoFinanceira[];
    },
  });
}

export function useSolicitacoesKpis() {
  return useQuery({
    queryKey: ['solicitacoes-financeiras-kpis'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('solicitacoes_financeiras')
        .select('valor, status, pago_em');
      if (error) throw error;

      const rows = (data ?? []) as Pick<SolicitacaoFinanceira, 'valor' | 'status' | 'pago_em'>[];
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const sumValor = (s: string) =>
        rows.filter((r) => r.status === s).reduce((acc, r) => acc + Number(r.valor || 0), 0);

      return {
        pendentesQtd: rows.filter((r) => r.status === 'pendente').length,
        pendentesValor: sumValor('pendente'),
        aprovadasQtd: rows.filter((r) => r.status === 'aprovado').length,
        aprovadasValor: sumValor('aprovado'),
        pagasMesValor: rows
          .filter((r) => r.status === 'pago' && r.pago_em && new Date(r.pago_em) >= inicioMes)
          .reduce((acc, r) => acc + Number(r.valor || 0), 0),
        rejeitadasQtd: rows.filter((r) => r.status === 'rejeitado').length,
      };
    },
  });
}

export function useAprovacoesSolicitacao(solicitacaoId: string | null) {
  return useQuery({
    queryKey: ['solicitacao-aprovacoes', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async (): Promise<AprovacaoSolicitacao[]> => {
      const { data, error } = await sb
        .from('solicitacoes_financeiras_aprovacoes')
        .select('*')
        .eq('solicitacao_id', solicitacaoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AprovacaoSolicitacao[];
    },
  });
}

// ============================================================
// MUTATIONS
// ============================================================
function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['solicitacoes-financeiras'] });
  queryClient.invalidateQueries({ queryKey: ['solicitacoes-financeiras-kpis'] });
}

export function useCriarSolicitacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaSolicitacaoInput) => {
      const { data, error } = await sb
        .from('solicitacoes_financeiras')
        .insert({
          tipo: input.tipo,
          categoria: input.categoria,
          subcategoria: input.subcategoria || null,
          descricao: input.descricao,
          valor: input.valor,
          solicitante_id: input.solicitante_id,
          solicitante_nome: input.solicitante_nome,
          favorecido_nome: input.favorecido_nome || null,
          favorecido_documento: input.favorecido_documento || null,
          forma_pagamento: input.forma_pagamento || null,
          banco: input.banco || null,
          agencia: input.agencia || null,
          conta: input.conta || null,
          pix_chave: input.pix_chave || null,
          data_necessidade: input.data_necessidade || null,
          comprovante_url: input.comprovante_url,
          observacao: input.observacao || null,
          criado_por: input.criado_por,
          status: 'pendente',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Solicitação enviada para liberação dos sócios!');
      invalidate(queryClient);
    },
    onError: () => toast.error('Erro ao enviar solicitação'),
  });
}

export function useRegistrarAprovacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      solicitacaoId: string;
      socioId: string;
      socioNome: string;
      decisao: 'aprovado' | 'rejeitado';
      comentario?: string;
    }) => {
      // upsert: cada sócio tem no máximo um voto por solicitação
      const { error } = await sb
        .from('solicitacoes_financeiras_aprovacoes')
        .upsert(
          {
            solicitacao_id: params.solicitacaoId,
            socio_id: params.socioId,
            socio_nome: params.socioNome,
            decisao: params.decisao,
            comentario: params.comentario || null,
          },
          { onConflict: 'solicitacao_id,socio_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, params) => {
      toast.success(params.decisao === 'aprovado' ? 'Liberação registrada!' : 'Solicitação rejeitada.');
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ['solicitacao-aprovacoes', params.solicitacaoId] });
    },
    onError: () => toast.error('Erro ao registrar decisão'),
  });
}

export function useCancelarSolicitacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (solicitacaoId: string) => {
      const { error } = await sb
        .from('solicitacoes_financeiras')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', solicitacaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Solicitação cancelada');
      invalidate(queryClient);
    },
    onError: () => toast.error('Erro ao cancelar solicitação'),
  });
}

/**
 * Efetua o pagamento (financeiro): cria a Conta a Pagar correspondente
 * e marca a solicitação como paga, vinculando os dois registros.
 */
export function usePagarSolicitacao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      solicitacao: SolicitacaoFinanceira;
      pagoPor: string | null;
      comprovantePagamentoUrl?: string;
    }) => {
      const { solicitacao, pagoPor } = params;
      const hoje = new Date().toISOString().slice(0, 10);

      // 1) Cria a Conta a Pagar (já quitada)
      const { data: conta, error: contaError } = await sb
        .from('contas_pagar')
        .insert({
          fornecedor_nome: solicitacao.favorecido_nome || solicitacao.solicitante_nome,
          fornecedor_documento: solicitacao.favorecido_documento || null,
          categoria: solicitacao.categoria,
          subcategoria: solicitacao.subcategoria || null,
          referencia_id: solicitacao.id,
          referencia_tipo: 'solicitacao_financeira',
          valor: solicitacao.valor,
          valor_pago: solicitacao.valor,
          data_emissao: hoje,
          data_vencimento: solicitacao.data_necessidade || hoje,
          data_pagamento: hoje,
          forma_pagamento: solicitacao.forma_pagamento || null,
          banco: solicitacao.banco || null,
          agencia: solicitacao.agencia || null,
          conta: solicitacao.conta || null,
          pix_chave: solicitacao.pix_chave || null,
          comprovante_url: params.comprovantePagamentoUrl || solicitacao.comprovante_url || null,
          status: 'pago',
          aprovado_por: pagoPor,
          aprovado_em: new Date().toISOString(),
          pago_por: pagoPor,
          observacao: `Solicitação financeira (${SOLICITACAO_TIPO_LABEL[solicitacao.tipo] || solicitacao.tipo}): ${solicitacao.descricao}`,
        })
        .select()
        .single();
      if (contaError) throw contaError;

      // 2) Marca a solicitação como paga e vincula a conta
      const { error: solicError } = await sb
        .from('solicitacoes_financeiras')
        .update({
          status: 'pago',
          pago_por: pagoPor,
          pago_em: new Date().toISOString(),
          conta_pagar_id: conta?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacao.id);
      if (solicError) throw solicError;

      return conta;
    },
    onSuccess: () => {
      toast.success('Pagamento efetuado e lançado em Contas a Pagar!');
      invalidate(queryClient);
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis'] });
    },
    onError: () => toast.error('Erro ao efetuar pagamento'),
  });
}
