import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { StatusCotacao } from '@/types/vendas';
import { registrarLog } from './useAuditLog';
import { isUniqueViolation } from '@/lib/errors';

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
  valorAdesao?: number;
  coberturas?: string[];
  naoInclui?: string[];
  coberturaFipe?: number;
  cota?: string;
  cotaPercentual?: number;
  cotaMinima?: number;
  cotaDesagio?: number;
  cotaMinimaDesagio?: number;
  adicionalMensal?: number;
  anoMinimo?: number;
  alertaDesagio?: string;
  coberturasRemovidas?: string[];
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
    adesao_paga?: boolean;
    associados?: { id: string; status: string } | null;
  } | null;
  instalacoes?: { id: string; status: string; data_agendada: string | null }[];
  dados_extras?: DadosExtrasCotacao | null;
}

export interface UseCotacoesOptions {
  vendedorId?: string;
  viewScope?: 'own' | 'team' | 'all';
  searchTerm?: string;
}

export function useCotacoes(options?: UseCotacoesOptions) {
  const search = (options?.searchTerm || '').trim();
  return useQuery({
    queryKey: ['cotacoes', options?.viewScope, options?.vendedorId, search],
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
            adesao_paga,
            associados:associados!fk_contratos_associado(id, status)
          ),
          instalacoes:instalacoes!instalacoes_cotacao_id_fkey(id, status, data_agendada)
        `)
        .order('created_at', { ascending: false })
        .limit(1000);
      
      // Filtrar por vendedor se viewScope = 'own'
      if (options?.viewScope === 'own' && options?.vendedorId) {
        query = query.eq('vendedor_id', options.vendedorId);
      }

      // Busca server-side (sem isso, busca em campos como `numero` ficava limitada
      // ao lote inicial de 100 cotações e perdia registros antigos).
      if (search) {
        const safe = search.replace(/[,()]/g, '');
        // Busca direta nos campos da cotação
        query = query.or(
          [
            `numero.ilike.%${safe}%`,
            `veiculo_placa.ilike.%${safe}%`,
            `veiculo_marca.ilike.%${safe}%`,
            `veiculo_modelo.ilike.%${safe}%`,
            `nome_solicitante.ilike.%${safe}%`,
            `telefone1_solicitante.ilike.%${safe}%`,
            `email_solicitante.ilike.%${safe}%`,
          ].join(',')
        );
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Buscar vendedores em lote (relacionando profiles.user_id = cotacoes.vendedor_id)
      const vendedorIds = Array.from(
        new Set((data || []).map((c: any) => c.vendedor_id).filter(Boolean))
      );
      const vendedoresMap = new Map<string, any>();
      if (vendedorIds.length > 0) {
        const { data: vendedores } = await supabase
          .from('profiles')
          .select('user_id, nome, email, whatsapp, full_name')
          .in('user_id', vendedorIds);
        (vendedores || []).forEach((v: any) => vendedoresMap.set(v.user_id, v));
      }

      // Mapear vendedor para formato esperado (incluindo whatsapp para PDF)
      const mapped = (data || []).map((cotacao: any) => {
        const v = cotacao.vendedor_id ? vendedoresMap.get(cotacao.vendedor_id) : null;
        return {
          ...cotacao,
          vendedor: v ? {
            id: v.user_id,
            nome: v.nome,
            email: v.email,
            whatsapp: v.whatsapp,
            full_name: v.full_name || v.nome,
          } : null,
          profiles: v ? {
            full_name: v.full_name || v.nome,
            whatsapp: v.whatsapp,
          } : null,
          contrato: Array.isArray(cotacao.contrato) 
            ? cotacao.contrato[0] || null 
            : cotacao.contrato || null,
        };
      });
      
      return mapped as CotacaoWithRelations[];
    },
    placeholderData: keepPreviousData,
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
          planos:planos!plano_id(*),
          contrato:contratos!contratos_cotacao_id_fkey(
            id, 
            numero, 
            status,
            adesao_paga,
            associados:associados!fk_contratos_associado(id, status)
          )
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
      
      // Garantir que contrato seja objeto ou null (não array)
      const contrato = Array.isArray(data.contrato) 
        ? data.contrato[0] || null 
        : data.contrato || null;
      
      return { ...data, vendedor, contrato } as CotacaoWithRelations;
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

      // Tenta inserir até 2x se houver colisão de número (23505)
      let lastError: unknown = null;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const { data, error } = await supabase
          .from('cotacoes')
          .insert({
            ...cotacao,
            numero: gerarNumeroCotacao(),
            token_publico: tokenPublico,
          })
          .select()
          .single();

        if (!error) return data as Cotacao;
        lastError = error;

        // Só faz retry se for colisão de unique (numero)
        if (!isUniqueViolation(error)) break;
        console.warn('[useCreateCotacao] Conflito de número da cotação, regenerando e tentando novamente...', error);
      }
      throw lastError;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      registrarLog({
        acao: 'criar',
        modulo: 'cotacoes',
        descricao: `Cotação ${data.numero} criada`,
        entidade_id: data.id,
        dados_novos: { numero: data.numero, status: data.status },
      });
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
      registrarLog({
        acao: 'editar',
        modulo: 'cotacoes',
        descricao: `Cotação ${data.numero} atualizada`,
        entidade_id: data.id,
      });
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
      registrarLog({
        acao: 'enviar',
        modulo: 'cotacoes',
        descricao: `Cotação ${data.numero} reenviada`,
        entidade_id: data.id,
      });
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
      registrarLog({
        acao: 'editar',
        modulo: 'cotacoes',
        descricao: `Status da cotação ${data.numero} alterado para ${data.status}`,
        entidade_id: data.id,
        dados_novos: { status: data.status },
      });
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
      registrarLog({
        acao: 'aprovar',
        modulo: 'cotacoes',
        descricao: 'Cotação aceita e contrato gerado',
      });
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

// Hook para duplicar cotação (com fluxo de correção: excluir ou substituir a original)
export interface DuplicarCotacaoParams {
  cotacaoId: string;
  motivo?: string;
  acaoOriginal?: 'excluir' | 'manter' | 'none';
}

export function useDuplicarCotacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: string | DuplicarCotacaoParams) => {
      const cotacaoId = typeof params === 'string' ? params : params.cotacaoId;
      const motivo = typeof params === 'string' ? undefined : params.motivo;
      const acaoOriginal = typeof params === 'string' ? 'none' : (params.acaoOriginal ?? 'none');

      // Buscar cotação original
      const { data: original, error: fetchError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoId)
        .single();

      if (fetchError) throw fetchError;
      if (!original) throw new Error('Cotação não encontrada');

      // Se for excluir, validar que não há contrato/agendamento (race-safety)
      if (acaoOriginal === 'excluir') {
        const [contratoRes, agendRes] = await Promise.all([
          supabase.from('contratos').select('id').eq('cotacao_id', cotacaoId).limit(1),
          supabase.from('agendamentos_base').select('id').eq('cotacao_id', cotacaoId).limit(1),
        ]);
        if ((contratoRes.data?.length ?? 0) > 0 || (agendRes.data?.length ?? 0) > 0) {
          throw new Error('Esta cotação já possui contrato ou agendamento. Recarregue a página e duplique novamente usando "Manter como substituída".');
        }
        if (!['rascunho', 'enviada'].includes(original.status as string)) {
          throw new Error('Cotações neste status não podem ser excluídas — use "Manter como substituída".');
        }
      }

      // Remover campos que serão gerados novamente
      const {
        id,
        numero,
        created_at,
        updated_at,
        substituida_por_cotacao_id,
        motivo_substituicao,
        token_publico,
        ...cotacaoData
      } = original as any;

      // Gera token público novo para a duplicata
      const tokenPublico = crypto.randomUUID().replace(/-/g, '') +
                          crypto.randomUUID().replace(/-/g, '').slice(0, 32);

      // Atribuir vendedor_id ao usuário atual (ex.: gestor corrigindo cotação alheia)
      const { data: { user } } = await supabase.auth.getUser();
      const novoVendedorId = user?.id ?? cotacaoData.vendedor_id;

      const { data: nova, error } = await supabase
        .from('cotacoes')
        .insert({
          ...cotacaoData,
          vendedor_id: novoVendedorId,
          numero: gerarNumeroCotacao(),
          status: 'rascunho',
          token_publico: tokenPublico,
        })
        .select()
        .single();

      if (error) throw error;

      // Pós-processamento na original conforme acaoOriginal
      if (acaoOriginal === 'manter') {
        await supabase
          .from('cotacoes')
          .update({
            status: 'recusada',
            substituida_por_cotacao_id: nova.id,
            motivo_substituicao: motivo ?? null,
          })
          .eq('id', cotacaoId);
      } else if (acaoOriginal === 'excluir') {
        // Tenta exclusão via Edge Function (cascata segura). Fallback: DELETE direto.
        try {
          const { data: delData, error: delErr } = await supabase.functions.invoke('delete-cotacao', {
            body: { cotacaoId, motivo: motivo ? `[Duplicação] ${motivo}` : '[Duplicação]' },
          });
          if (delErr || !delData?.success) {
            throw new Error(delErr?.message || delData?.error || 'Falha ao excluir original');
          }
        } catch (e) {
          console.warn('[useDuplicarCotacao] delete-cotacao falhou, tentando DELETE direto:', e);
          const { error: directDelErr } = await supabase
            .from('cotacoes')
            .delete()
            .eq('id', cotacaoId);
          if (directDelErr) {
            console.error('[useDuplicarCotacao] DELETE direto também falhou:', directDelErr);
            toast.warning('Duplicata criada, mas não foi possível excluir a original. Você pode excluí-la manualmente.');
          }
        }
      }

      return { ...nova, _originalId: cotacaoId, _acaoOriginal: acaoOriginal, _motivo: motivo };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Cotação duplicada com sucesso!');

      const acao = data._acaoOriginal as 'excluir' | 'manter' | 'none';
      if (acao === 'excluir') {
        registrarLog({
          acao: 'excluir',
          modulo: 'cotacoes',
          descricao: `Cotação original excluída em duplicação. Nova: ${data.numero}. Motivo: ${data._motivo ?? '—'}`,
          entidade_id: data._originalId,
          dados_novos: { nova_cotacao_id: data.id, motivo: data._motivo },
        });
      } else if (acao === 'manter') {
        registrarLog({
          acao: 'duplicar',
          modulo: 'cotacoes',
          descricao: `Cotação substituída por ${data.numero}. Motivo: ${data._motivo ?? '—'}`,
          entidade_id: data._originalId,
          dados_novos: { nova_cotacao_id: data.id, motivo: data._motivo },
        });
      }

      registrarLog({
        acao: 'duplicar',
        modulo: 'cotacoes',
        descricao: `Cotação duplicada: ${data.numero}`,
        entidade_id: data.id,
      });
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Erro ao duplicar cotação');
    },
  });
}

// Hook para excluir cotação (usa Edge Function para exclusão cascata completa)
export function useExcluirCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, motivo }: { cotacaoId: string; motivo?: string }) => {
      console.log('[useExcluirCotacao] Iniciando exclusão:', cotacaoId);
      
      const { data, error } = await supabase.functions.invoke('delete-cotacao', {
        body: { cotacaoId, motivo },
      });
      
      if (error) {
        console.error('[useExcluirCotacao] Erro na Edge Function:', {
          message: error.message,
          name: error.name,
          context: error,
        });
        throw new Error(error.message || 'Erro ao excluir cotação');
      }
      
      console.log('[useExcluirCotacao] Resposta da Edge Function:', data);
      
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao excluir cotação');
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success(data?.message || 'Cotação excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao excluir cotação:', error);
      toast.error(error.message || 'Erro ao excluir cotação');
    },
  });
}
