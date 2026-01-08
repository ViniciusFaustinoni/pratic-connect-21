import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export type StatusExtrato = 'pendente' | 'processando' | 'processado' | 'conciliado' | 'erro';
export type TipoMovimentacaoBancaria = 'credito' | 'debito';
export type TipoContaBancaria = 'corrente' | 'poupanca' | 'investimento';

export interface ContaBancaria {
  id: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  digito?: string;
  tipo: TipoContaBancaria;
  descricao?: string;
  saldo_atual: number;
  data_saldo?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExtratoBancario {
  id: string;
  conta_bancaria_id: string;
  arquivo_nome: string;
  arquivo_path?: string;
  data_inicio?: string;
  data_fim?: string;
  saldo_inicial?: number;
  saldo_final?: number;
  total_creditos: number;
  total_debitos: number;
  qtd_lancamentos: number;
  qtd_conciliados: number;
  status: StatusExtrato;
  erro_mensagem?: string;
  importado_por?: string;
  created_at: string;
  updated_at: string;
  conta_bancaria?: ContaBancaria;
}

export interface MovimentacaoBancaria {
  id: string;
  extrato_id: string;
  conta_bancaria_id: string;
  data_lancamento: string;
  descricao: string;
  documento?: string;
  valor: number;
  tipo: TipoMovimentacaoBancaria;
  saldo_apos?: number;
  categoria?: string;
  subcategoria?: string;
  origem_pagamento?: string;
  nome_pagador?: string;
  conciliado: boolean;
  cobranca_id?: string;
  hash_lancamento: string;
  created_at: string;
}

// ================== QUERIES ==================

// Buscar todas as contas bancárias
export function useContasBancarias() {
  return useQuery({
    queryKey: ['contas-bancarias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_bancarias')
        .select('*')
        .eq('ativo', true)
        .order('banco_nome');

      if (error) throw error;
      return data as ContaBancaria[];
    },
  });
}

// Buscar uma conta bancária específica
export function useContaBancaria(id: string | undefined) {
  return useQuery({
    queryKey: ['contas-bancarias', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('contas_bancarias')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ContaBancaria;
    },
    enabled: !!id,
  });
}

// Buscar extratos bancários (com filtro opcional por conta)
export function useExtratosBancarios(contaId?: string) {
  return useQuery({
    queryKey: ['extratos-bancarios', contaId],
    queryFn: async () => {
      let query = supabase
        .from('extratos_bancarios')
        .select('*, conta_bancaria:contas_bancarias(*)')
        .order('created_at', { ascending: false });

      if (contaId) {
        query = query.eq('conta_bancaria_id', contaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExtratoBancario[];
    },
  });
}

// Buscar um extrato específico
export function useExtratoBancario(id: string | undefined) {
  return useQuery({
    queryKey: ['extratos-bancarios', 'detalhe', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('extratos_bancarios')
        .select('*, conta_bancaria:contas_bancarias(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ExtratoBancario;
    },
    enabled: !!id,
  });
}

// Buscar movimentações de um extrato
export function useMovimentacoesBancarias(extratoId: string | undefined) {
  return useQuery({
    queryKey: ['movimentacoes-bancarias', extratoId],
    queryFn: async () => {
      if (!extratoId) return [];
      const { data, error } = await supabase
        .from('movimentacoes_bancarias')
        .select('*')
        .eq('extrato_id', extratoId)
        .order('data_lancamento', { ascending: true });

      if (error) throw error;
      return data as MovimentacaoBancaria[];
    },
    enabled: !!extratoId,
  });
}

// ================== MUTATIONS ==================

// Criar conta bancária
export function useCreateContaBancaria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ContaBancaria, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('contas_bancarias')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta bancária criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar conta bancária: ' + error.message);
    },
  });
}

// Atualizar conta bancária
export function useUpdateContaBancaria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ContaBancaria> & { id: string }) => {
      const { error } = await supabase
        .from('contas_bancarias')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success('Conta bancária atualizada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar conta bancária: ' + error.message);
    },
  });
}

// Helper: converter arquivo para base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo data:...;base64,
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

// Upload e processamento de extrato
export function useUploadExtrato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contaId, arquivo }: { contaId: string; arquivo: File }) => {
      // 1. Converter arquivo para base64 primeiro
      const arquivoBase64 = await fileToBase64(arquivo);

      // 2. Criar registro do extrato com status pendente
      // data_inicio e data_fim serão preenchidos pela Edge Function
      const today = new Date().toISOString().split('T')[0];
      const { data: extrato, error: insertError } = await supabase
        .from('extratos_bancarios')
        .insert({
          conta_bancaria_id: contaId,
          arquivo_nome: arquivo.name,
          status: 'pendente',
          data_inicio: today,
          data_fim: today,
          total_creditos: 0,
          total_debitos: 0,
          qtd_lancamentos: 0,
          qtd_conciliados: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Chamar Edge Function para processar
      const { data: result, error: fnError } = await supabase.functions.invoke('processar-extrato', {
        body: {
          extrato_id: extrato.id,
          arquivo_base64: arquivoBase64,
        },
      });

      if (fnError) throw fnError;

      if (!result.success) {
        throw new Error(result.error || 'Erro ao processar extrato');
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['extratos-bancarios'] });
      queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] });
      toast.success(
        `Extrato processado: ${result.dados.lancamentos_inseridos} lançamentos importados`
      );
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['extratos-bancarios'] });
      toast.error('Erro ao processar extrato: ' + error.message);
    },
  });
}

// Conciliar movimentação com cobrança
export function useConciliarMovimentacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      movimentacaoId, 
      cobrancaId 
    }: { 
      movimentacaoId: string; 
      cobrancaId?: string;
    }) => {
      const { error } = await supabase
        .from('movimentacoes_bancarias')
        .update({
          conciliado: true,
          cobranca_id: cobrancaId,
        })
        .eq('id', movimentacaoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes-bancarias'] });
      queryClient.invalidateQueries({ queryKey: ['extratos-bancarios'] });
      toast.success('Movimentação conciliada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao conciliar: ' + error.message);
    },
  });
}
