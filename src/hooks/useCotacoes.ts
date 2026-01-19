import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { StatusCotacao } from '@/types/vendas';

type Cotacao = Tables<'cotacoes'>;
type CotacaoInsert = TablesInsert<'cotacoes'>;
type CotacaoUpdate = TablesUpdate<'cotacoes'>;

// Gera número único para cotação: COT-YYYYMMDD-HHMMSSMMM-XXX
function gerarNumeroCotacao(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  const hora = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seg = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `COT-${ano}${mes}${dia}-${hora}${min}${seg}${ms}-${random}`;
}

export interface PlanoComparacao {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  coberturas?: string[];
}

export interface DadosExtrasCotacao {
  planos_comparacao?: PlanoComparacao[];
  [key: string]: unknown;
}

export interface CotacaoWithRelations extends Omit<Cotacao, 'dados_extras'> {
  leads?: Tables<'leads'> | null;
  planos?: Tables<'planos'> | null;
  vendedor?: {
    id: string;
    nome: string;
    email: string;
  } | null;
  contrato?: {
    id: string;
    numero: string;
    status: string;
    associados?: { id: string; status: string } | null;
  } | null;
  instalacoes?: { id: string; status: string; data_agendada: string | null }[];
  dados_extras?: DadosExtrasCotacao | null;
}

export interface UseCotacoesOptions {
  vendedorId?: string;
  viewScope?: 'own' | 'team' | 'all';
}

export function useCotacoes(options?: UseCotacoesOptions) {
  return useQuery({
    queryKey: ['cotacoes', options?.viewScope, options?.vendedorId],
    queryFn: async () => {
      let query = supabase
        .from('cotacoes')
        .select(`
          *,
          leads:leads!fk_cotacoes_lead_id(id, nome, telefone, email),
          planos:planos!plano_id(id, nome, codigo, coberturas),
          contrato:contratos!contratos_cotacao_id_fkey(
            id, 
            numero, 
            status,
            associados:associados!fk_contratos_associado(id, status)
          ),
          instalacoes:instalacoes!instalacoes_cotacao_id_fkey(id, status, data_agendada),
          vendedor:profiles!cotacoes_vendedor_profiles_fkey(user_id, nome, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      // Filtrar por vendedor se viewScope = 'own'
      if (options?.viewScope === 'own' && options?.vendedorId) {
        query = query.eq('vendedor_id', options.vendedorId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Mapear vendedor para formato esperado
      const mapped = (data || []).map((cotacao: any) => ({
        ...cotacao,
        vendedor: cotacao.vendedor ? {
          id: cotacao.vendedor.user_id,
          nome: cotacao.vendedor.nome,
          email: cotacao.vendedor.email,
        } : null,
        // Garantir que contrato seja objeto ou null (não array)
        contrato: Array.isArray(cotacao.contrato) 
          ? cotacao.contrato[0] || null 
          : cotacao.contrato || null,
      }));
      
      return mapped as CotacaoWithRelations[];
    },
    staleTime: 1000 * 60 * 1, // Reduzido para 1 minuto para melhor responsividade
  });
}

export function useCotacao(id: string | undefined) {
  return useQuery({
    queryKey: ['cotacoes', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          leads:leads!fk_cotacoes_lead_id(*),
          planos:planos!plano_id(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Buscar vendedor separadamente
      let vendedor = null;
      if (data.vendedor_id) {
        const { data: v } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .eq('user_id', data.vendedor_id)
          .single();
        vendedor = v ? { id: v.user_id, nome: v.nome, email: v.email } : null;
      }
      
      return { ...data, vendedor } as CotacaoWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cotacao: Omit<CotacaoInsert, 'numero'>) => {
      // Validação: vendedor_id é obrigatório para garantir visibilidade via RLS
      if (!cotacao.vendedor_id) {
        throw new Error('vendedor_id é obrigatório para criar cotações');
      }
      
      // Gera token público para link do cliente
      const tokenPublico = crypto.randomUUID().replace(/-/g, '') + 
                          crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      
      const { data, error } = await supabase
        .from('cotacoes')
        .insert({
          ...cotacao,
          numero: gerarNumeroCotacao(),
          token_publico: tokenPublico,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
    },
  });
}

export function useUpdateCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: CotacaoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
    },
  });
}

// Hook para reenviar cotação (atualiza updated_at)
export function useReenviarCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
      toast.success('Cotação reenviada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao reenviar cotação');
    },
  });
}

// Hook para atualizar status
export function useAtualizarStatusCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusCotacao }) => {
      const { data, error } = await supabase
        .from('cotacoes')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Cotacao;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes', data.id] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

// Hook para aceitar cotação e gerar contrato
export function useAceitarCotacaoEGerarContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, vendedorId }: { cotacaoId: string; vendedorId?: string }) => {
      // 1. Atualizar status da cotação para 'aceita'
      const { error: updateError } = await supabase
        .from('cotacoes')
        .update({ status: 'aceita' })
        .eq('id', cotacaoId);
      
      if (updateError) throw updateError;
      
      // 2. Chamar edge function para gerar contrato
      const { data, error: fnError } = await supabase.functions.invoke('contrato-gerar', {
        body: { cotacao_id: cotacaoId, vendedor_id: vendedorId },
      });
      
      if (fnError) throw fnError;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
      toast.success('Cotação aceita e contrato gerado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao aceitar cotação:', error);
      toast.error('Erro ao aceitar cotação: ' + error.message);
    },
  });
}

// Hook combinado para actions
export function useCotacaoActions() {
  const reenviar = useReenviarCotacao();
  const atualizarStatus = useAtualizarStatusCotacao();
  
  return {
    reenviarCotacao: reenviar.mutate,
    atualizarStatus: atualizarStatus.mutate,
    isReenviando: reenviar.isPending,
    isAtualizando: atualizarStatus.isPending,
  };
}

// Hook para duplicar cotação
export function useDuplicarCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cotacaoId: string) => {
      // Buscar cotação original
      const { data: original, error: fetchError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!original) throw new Error('Cotação não encontrada');
      
      // Remover campos que serão gerados novamente
      const { id, numero, created_at, updated_at, ...cotacaoData } = original;
      
      // Criar cópia com novo número e status rascunho
      const { data, error } = await supabase
        .from('cotacoes')
        .insert({
          ...cotacaoData,
          numero: `COT-${Date.now()}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
          status: 'rascunho',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Cotação duplicada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao duplicar cotação');
    },
  });
}

// Hook para excluir cotação (exclui todos os registros dependentes)
export function useExcluirCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cotacaoId: string) => {
      // 1. PRIMEIRO: Quebrar referência circular - nullificar vistoria_id na cotação
      const { error: cotacaoVistError } = await supabase
        .from('cotacoes')
        .update({ vistoria_id: null })
        .eq('id', cotacaoId);
      
      if (cotacaoVistError) {
        console.error('Erro ao limpar vistoria_id da cotação:', cotacaoVistError);
        throw cotacaoVistError;
      }

      // 2. Nullificar vistoria_id nos contratos vinculados (evitar FK block)
      const { error: contratoVistError } = await supabase
        .from('contratos')
        .update({ vistoria_id: null })
        .eq('cotacao_id', cotacaoId);
      
      if (contratoVistError) {
        console.error('Erro ao limpar vistoria_id dos contratos:', contratoVistError);
        throw contratoVistError;
      }

      // 3. Excluir contratos vinculados
      const { error: contratoError } = await supabase
        .from('contratos')
        .delete()
        .eq('cotacao_id', cotacaoId);
      
      if (contratoError) {
        console.error('Erro ao excluir contratos da cotação:', contratoError);
        throw contratoError;
      }

      // 4. Excluir instalações vinculadas
      const { error: instError } = await supabase
        .from('instalacoes')
        .delete()
        .eq('cotacao_id', cotacaoId);
      
      if (instError) {
        console.error('Erro ao excluir instalações da cotação:', instError);
        throw instError;
      }

      // 5. Excluir vistorias vinculadas (agora sem referências bloqueando)
      const { error: vistError } = await supabase
        .from('vistorias')
        .delete()
        .eq('cotacao_id', cotacaoId);
      
      if (vistError) {
        console.error('Erro ao excluir vistorias da cotação:', vistError);
        throw vistError;
      }

      // 6. Limpar referência no lead (SET NULL)
      const { error: leadError } = await supabase
        .from('leads')
        .update({ cotacao_id: null })
        .eq('cotacao_id', cotacaoId);
      
      if (leadError) {
        console.error('Erro ao limpar cotacao_id do lead:', leadError);
        throw leadError;
      }
      
      // 7. Finalmente excluir a cotação
      const { error } = await supabase
        .from('cotacoes')
        .delete()
        .eq('id', cotacaoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Cotação excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir cotação:', error);
      toast.error('Erro ao excluir cotação. Verifique se há registros dependentes.');
    },
  });
}
